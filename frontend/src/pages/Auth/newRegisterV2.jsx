import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  TextField,
  Paper,
  InputAdornment,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Avatar,
  Link,
  Chip,
  LinearProgress,
  Grid,
} from "@mui/material";

import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Mail as MailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Store as StoreIcon,
  Work as WorkIcon,
  Home as HomeIcon,
  Visibility,
  VisibilityOff,
  Lock as LockIcon,
  CheckCircle as CheckCircleIcon,
  HelpOutline as HelpOutlineIcon,
  ArrowForwardIos as ArrowForwardIosIcon,
} from "@mui/icons-material";

import { useNavigate, useParams, useLocation } from "react-router-dom";
import API from "././api/api";
import LOGO from "././assets/TRIKONEKT.jpg";

/**
 * RegisterV2 - FULL REDESIGN
 * - Step 1: Select Category (cards)
 * - Step 2: Registration form (Stepper + Sponsor + Fields)
 *
 * IMPORTANT: Existing API logic and validations are preserved.
 */
const RegisterV2 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role: roleParam } = useParams();

  // ---------------------------
  // UI Step Control
  // ---------------------------
  // 1 = Category selection
  // 2 = Form
  const [step, setStep] = useState(1);

  // ---------------------------
  // Role handling
  // ---------------------------
  const ALLOWED_ROLES = ["user", "agency", "employee", "business"];
  const lockedRole = ALLOWED_ROLES.includes(String(roleParam || "").toLowerCase())
    ? String(roleParam).toLowerCase()
    : null;

  const [role, setRole] = useState(lockedRole || "user");

  // ---------------------------
  // Form + auth states
  // ---------------------------
  const [formData, setFormData] = useState({
    password: "",
    email: "",
    full_name: "",
    phone: "",
    business_name: "",
    business_category: "",
    address: "",
  });

  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Merchant categories (public) + dependent subcategories
  const [mCategories, setMCategories] = useState([]);
  const [mSubcategories, setMSubcategories] = useState([]);
  const [mCatId, setMCatId] = useState("");
  const [mSubcatId, setMSubcatId] = useState("");
  const [mLoading, setMLoading] = useState({ cats: false, subs: false });

  // ---------------------------
  // Sponsor
  // ---------------------------
  const [sponsorId, setSponsorId] = useState("");
  const [sponsorLocked, setSponsorLocked] = useState(false);
  const [sponsorChecking, setSponsorChecking] = useState(false);
  const [sponsorValid, setSponsorValid] = useState(null);
  const [sponsorDisplay, setSponsorDisplay] = useState({
    name: "",
    pincode: "",
    username: "",
  });

  // ---------------------------
  // Agency
  // ---------------------------
  const [agencyLevel, setAgencyLevel] = useState("");

  const mapAgencyLevelToCategory = (lvl) => {
    switch (lvl) {
      case "state_coordinator":
        return "agency_state_coordinator";
      case "state":
        return "agency_state";
      case "district_coordinator":
        return "agency_district_coordinator";
      case "district":
        return "agency_district";
      case "pincode_coordinator":
        return "agency_pincode_coordinator";
      case "pincode":
        return "agency_pincode";
      case "sub_franchise":
        return "agency_sub_franchise";
      default:
        return "agency";
    }
  };

  // Agency assign states/district/pincodes
  const [assignStates, setAssignStates] = useState([]);
  const [assignDistricts, setAssignDistricts] = useState([]);
  const [assignPincodes, setAssignPincodes] = useState([]);
  const [selectedDistrictAgency, setSelectedDistrictAgency] = useState("");
  const [selectedPincodeAgency, setSelectedPincodeAgency] = useState("");

  // sponsor derived scope lists
  const [sponsorStates, setSponsorStates] = useState([]);
  const [sponsorDistricts, setSponsorDistricts] = useState([]);
  const [sponsorPincodes, setSponsorPincodes] = useState([]);

  // ---------------------------
  // Location (Non-agency)
  // ---------------------------
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCityId, setSelectedCityId] = useState("");
  const [pincode, setPincode] = useState("");

  // Non-agency district pincodes (if API provides)
  const [nonAgencyDistrictPincodes, setNonAgencyDistrictPincodes] = useState([]);
  const [pinByDistrictLoadingNA, setPinByDistrictLoadingNA] = useState(false);

  // Geo names (optional)
  const [geoCountryName, setGeoCountryName] = useState("");
  const [geoStateName, setGeoStateName] = useState("");
  const [geoCityName, setGeoCityName] = useState("");

  // ---------------------------
  // Alerts + Success
  // ---------------------------
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [regSuccessOpen, setRegSuccessOpen] = useState(false);
  const [regSuccessText, setRegSuccessText] = useState({
    username: "",
    password: "",
  });

  // ---------------------------
  // Helpers
  // ---------------------------
  const prettyRole = (r) => {
    const v = String(r || "").toLowerCase();
    if (v === "user") return "Consumer";
    if (v === "agency") return "Agency";
    if (v === "employee") return "Employee";
    if (v === "business") return "Merchant";
    return "Consumer";
  };

  const normalizeSponsor = (s) => String(s || "").trim();

  const toArray = (obj, keys = []) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj;
    for (const k of keys) {
      if (Array.isArray(obj?.[k])) return obj[k];
    }
    if (Array.isArray(obj?.results)) return obj.results;
    return [];
  };

  // Agency categories
  const AGENCY_CATEGORIES = useMemo(
    () =>
      new Set([
        "agency_state_coordinator",
        "agency_state",
        "agency_district_coordinator",
        "agency_district",
        "agency_pincode_coordinator",
        "agency_pincode",
        "agency_sub_franchise",
      ]),
    []
  );

  const mapUIRoleToCategory = () => {
    if (role === "user") return "consumer";
    if (role === "employee") return "employee";
    if (role === "business") return "business";
    if (role === "agency") return mapAgencyLevelToCategory(agencyLevel);
    return "consumer";
  };

  // Agency flags
  const isSC = role === "agency" && agencyLevel === "state_coordinator";
  const isStateCat = role === "agency" && agencyLevel === "state";
  const isDC = role === "agency" && agencyLevel === "district_coordinator";
  const isDistrictCat = role === "agency" && agencyLevel === "district";
  const isPC = role === "agency" && agencyLevel === "pincode_coordinator";
  const isPincodeCat = role === "agency" && agencyLevel === "pincode";
  const isSubFranchiseCat = role === "agency" && agencyLevel === "sub_franchise";

  // District options derived from sponsorDistricts
  const districtOptions = useMemo(() => {
    const list = (sponsorDistricts || [])
      .filter((d) => String(d.state_id) === String(selectedState))
      .map((d) => d.district)
      .filter(Boolean);
    return Array.from(new Set(list));
  }, [sponsorDistricts, selectedState]);

  // Pincode options derived from sponsorPincodes
  const pincodeOptions = useMemo(() => {
    // sponsorPincodes expected array of strings or numbers
    const arr = (sponsorPincodes || []).map((p) => String(p));
    return Array.from(new Set(arr));
  }, [sponsorPincodes]);

  // ---------------------------
  // Load countries (public)
  // ---------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await API.get("/location/countries/");
        if (!cancelled) setCountries(toArray(res?.data, ["countries", "results"]));
      } catch (_) {
        if (!cancelled) setCountries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadStates = async (countryId) => {
    try {
      const res = await API.get("/location/states/", { params: { country: countryId } });
      setStates(toArray(res?.data, ["states", "results"]));
    } catch {
      setStates([]);
    }
  };

  const loadCities = async (stateId) => {
    try {
      const res = await API.get("/location/cities/", { params: { state: stateId } });
      setCities(toArray(res?.data, ["cities", "results"]));
    } catch {
      setCities([]);
    }
  };

  const handleCountryChange = (e) => {
    const value = e.target.value;
    setSelectedCountry(value);
    setSelectedState("");
    setSelectedCity("");
    setSelectedCityId("");
    setStates([]);
    setCities([]);
    setPincode("");
    setNonAgencyDistrictPincodes([]);
    if (value) loadStates(value);
  };

  const handleStateChange = (e) => {
    const value = e.target.value;
    setSelectedState(value);
    setSelectedCity("");
    setSelectedCityId("");
    setCities([]);
    setPincode("");
    setNonAgencyDistrictPincodes([]);
    if (value) loadCities(value);
  };

  // Lookup location by pincode (optional)
  const fetchFromBackendPin = async (code) => {
    const pin = String(code || "").replace(/\D/g, "");
    if (pin.length !== 6) return;
    try {
      const resp = await API.get(`/location/pincode/${pin}/`);
      const payload = resp?.data || {};
      const detectedCity = payload.city || payload.district || "";
      const detectedState = payload.state || "";
      const detectedCountry = payload.country || "";

      if (detectedCity) setGeoCityName(detectedCity);
      if (detectedState) setGeoStateName(detectedState);
      if (detectedCountry) setGeoCountryName(detectedCountry);
    } catch (_) {}
  };

  const handlePincodeManualChange = (val) => {
    const next = String(val || "").replace(/\D/g, "").slice(0, 6);
    setPincode(next);
  };

  // When pincode becomes 6 digits, attempt geo detect
  useEffect(() => {
    if (pincode && String(pincode).length === 6) fetchFromBackendPin(pincode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode]);

  // ---------------------------
  // Merchant Categories (public)
  // ---------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMLoading((s) => ({ ...s, cats: true }));
      try {
        const res = await API.get("/merchant/categories/", { dedupe: "cancelPrevious" });
        const arr = Array.isArray(res?.data) ? res.data : res?.data?.results || [];
        if (!cancelled) setMCategories(Array.isArray(arr) ? arr : []);
      } catch (_) {
        if (!cancelled) setMCategories([]);
      } finally {
        if (!cancelled) setMLoading((s) => ({ ...s, cats: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMSubcategories([]);
    setMSubcatId("");
    const cid = String(mCatId || "");
    if (!cid) return;

    (async () => {
      setMLoading((s) => ({ ...s, subs: true }));
      try {
        const res = await API.get("/merchant/subcategories/", {
          params: { category_id: cid },
          dedupe: "cancelPrevious",
        });
        const arr = Array.isArray(res?.data) ? res.data : res?.data?.results || [];
        if (!cancelled) setMSubcategories(Array.isArray(arr) ? arr : []);
      } catch (_) {
        if (!cancelled) setMSubcategories([]);
      } finally {
        if (!cancelled) setMLoading((s) => ({ ...s, subs: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mCatId]);

  // ---------------------------
  // Sponsor prefill from URL
  // ---------------------------
  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const s = normalizeSponsor(params.get("sponsor") || "");
    if (s) {
      setSponsorId(s);
      setSponsorLocked(true);
      // auto validate sponsor
      setTimeout(() => {
        validateSponsor(s);
      }, 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------
  // Sponsor validation (API)
  // ---------------------------
  const sponsorCheckTimer = useRef(null);

  const validateSponsor = async (value) => {
    const v = normalizeSponsor(value);
    if (!v) {
      setSponsorValid(null);
      setSponsorDisplay({ name: "", pincode: "", username: "" });
      setSponsorStates([]);
      setSponsorDistricts([]);
      setSponsorPincodes([]);
      return;
    }

    setSponsorChecking(true);
    setSponsorValid(null);

    try {
      // NOTE: Keep same endpoint as your backend
      // If your existing project uses a different endpoint, update here.
      const res = await API.get(`/accounts/sponsor/${encodeURIComponent(v)}/`, {
        dedupe: "cancelPrevious",
      });

      const data = res?.data || {};
      const ok = !!(data?.valid ?? data?.username ?? data?.sponsor_id);

      if (ok) {
        setSponsorValid(true);
        setSponsorDisplay({
          username: data?.username || v,
          name: data?.name || data?.full_name || "",
          pincode: data?.pincode || "",
        });

        // sponsor assignment scope (if backend returns)
        setSponsorStates(Array.isArray(data?.states) ? data.states : []);
        setSponsorDistricts(Array.isArray(data?.districts) ? data.districts : []);
        setSponsorPincodes(Array.isArray(data?.pincodes) ? data.pincodes : []);
      } else {
        setSponsorValid(false);
        setSponsorDisplay({ name: "", pincode: "", username: "" });
        setSponsorStates([]);
        setSponsorDistricts([]);
        setSponsorPincodes([]);
      }
    } catch (_) {
      setSponsorValid(false);
      setSponsorDisplay({ name: "", pincode: "", username: "" });
      setSponsorStates([]);
      setSponsorDistricts([]);
      setSponsorPincodes([]);
    } finally {
      setSponsorChecking(false);
    }
  };

  // Sponsor input change (debounced)
  useEffect(() => {
    if (sponsorLocked) return;
    if (sponsorCheckTimer.current) clearTimeout(sponsorCheckTimer.current);

    sponsorCheckTimer.current = setTimeout(() => {
      validateSponsor(sponsorId);
    }, 600);

    return () => {
      if (sponsorCheckTimer.current) clearTimeout(sponsorCheckTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId]);

  // ---------------------------
  // Form changes
  // ---------------------------
  const handleChange = (e) =>
    setFormData((fd) => ({
      ...fd,
      [e.target.name]: e.target.value,
    }));

  // ---------------------------
  // Agency input validation
  // ---------------------------
  const validateAgencyInputs = () => {
    if (!sponsorId.trim()) {
      setErrorMsg("Sponsor Username is required for agency registrations.");
      return false;
    }

    if (!agencyLevel) {
      setErrorMsg("Select Agency Registration Type");
      return false;
    }

    if (isSC) {
      if (!assignStates.length) {
        setErrorMsg("Select at least 1 state.");
        return false;
      }
      if (assignStates.length > 2) {
        setErrorMsg("You can select maximum 2 states.");
        return false;
      }
    } else if (isStateCat) {
      if (!selectedState) {
        setErrorMsg("Please select a State.");
        return false;
      }
      if (sponsorStates.length && !sponsorStates.some((s) => String(s.id) === String(selectedState))) {
        setErrorMsg("Selected State is not under the Sponsor's assignment.");
        return false;
      }
    } else if (isDC) {
      if (!selectedState) {
        setErrorMsg("Please select a State.");
        return false;
      }
      if (!assignDistricts.length) {
        setErrorMsg("Select at least one District (max 2).");
        return false;
      }
      if (assignDistricts.length > 2) {
        setErrorMsg("You can select maximum 2 districts.");
        return false;
      }
    } else if (isDistrictCat) {
      if (!selectedState) {
        setErrorMsg("Please select a State.");
        return false;
      }
      if (!selectedDistrictAgency.trim()) {
        setErrorMsg("Please select a District.");
        return false;
      }
      if (
        sponsorDistricts.length &&
        !sponsorDistricts.some(
          (d) =>
            String(d.state_id) === String(selectedState) &&
            String(d.district).toLowerCase() === selectedDistrictAgency.trim().toLowerCase()
        )
      ) {
        setErrorMsg("Selected District is not under the Sponsor's assignment for the chosen State.");
        return false;
      }
    } else if (isPC) {
      if (!selectedState) {
        setErrorMsg("Please select a State.");
        return false;
      }
      if (!selectedDistrictAgency.trim()) {
        setErrorMsg("Please select a District.");
        return false;
      }
      if (!assignPincodes.length) {
        setErrorMsg("Select at least one pincode (max 4).");
        return false;
      }
      if (assignPincodes.length > 4) {
        setErrorMsg("You can select maximum 4 pincodes.");
        return false;
      }
      if (sponsorPincodes.length && assignPincodes.some((p) => !sponsorPincodes.includes(p))) {
        setErrorMsg("One or more selected pincodes are not under the Sponsor's assignment.");
        return false;
      }
    } else if (isPincodeCat || isSubFranchiseCat) {
      if (isSubFranchiseCat) {
        if (!selectedState) {
          setErrorMsg("Please select a State.");
          return false;
        }
        if (!selectedDistrictAgency.trim()) {
          setErrorMsg("Please select a City/District.");
          return false;
        }
      }
      if (!selectedPincodeAgency.trim() || !/^\d{6}$/.test(selectedPincodeAgency.trim())) {
        setErrorMsg("Please select a valid 6-digit pincode.");
        return false;
      }
      if (isPincodeCat && sponsorPincodes.length && !sponsorPincodes.includes(selectedPincodeAgency.trim())) {
        setErrorMsg("Selected pincode is not under the Sponsor's assignment.");
        return false;
      }
    }

    setErrorMsg("");
    return true;
  };

  // ---------------------------
  // Render registration fields by role
  // ---------------------------
  const renderRegistrationFields = () => {
    switch (role) {
      case "user":
      case "employee":
        return (
          <>
            <TextField
              fullWidth
              label="Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailIcon />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              sx={{ mb: 2 }}
              type="tel"
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Pincode"
              value={pincode}
              onChange={(e) => handlePincodeManualChange(e.target.value)}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
              helperText="Enter 6-digit pincode"
              sx={{ mb: 2 }}
              required
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Country</InputLabel>
              <Select label="Country" value={selectedCountry} onChange={handleCountryChange} required>
                {(countries || []).map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>State</InputLabel>
              <Select
                label="State"
                value={selectedState}
                onChange={handleStateChange}
                required
                disabled={!selectedCountry}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {(states || []).map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>District</InputLabel>
              <Select
                label="District"
                value={selectedCity}
                onChange={(e) => {
                  const name = e.target.value;
                  setSelectedCity(name);
                  try {
                    const norm = (v) => String(v || "").trim().toLowerCase();
                    const m = (cities || []).find(
                      (c) => norm(c?.name || c?.Name || c?.city || c?.City) === norm(name)
                    );
                    setSelectedCityId(m ? String(m.id) : "");
                  } catch (_) {}
                }}
                required
                disabled={!selectedState}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {Array.from(
                  new Set(
                    (cities || [])
                      .map((c) => c?.name || c?.Name || c?.city || c?.City)
                      .filter(Boolean)
                  )
                ).map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        );

      case "agency":
        return (
          <>
            <TextField
              fullWidth
              label="Agency Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <StoreIcon />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailIcon />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              sx={{ mb: 2 }}
              type="tel"
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Registration Type</InputLabel>
              <Select
                value={agencyLevel}
                label="Registration Type"
                onChange={(e) => {
                  setAgencyLevel(e.target.value);
                  setAssignStates([]);
                  setAssignDistricts([]);
                  setSelectedDistrictAgency("");
                  setAssignPincodes([]);
                  setSelectedPincodeAgency("");
                  setSelectedState("");
                  setSelectedCountry("");
                }}
                required
              >
                <MenuItem value="state_coordinator">State Coordinator</MenuItem>
                <MenuItem value="state">State</MenuItem>
                <MenuItem value="district_coordinator">District Coordinator</MenuItem>
                <MenuItem value="district">District</MenuItem>
                <MenuItem value="pincode_coordinator">Pincode Coordinator</MenuItem>
                <MenuItem value="pincode">Pincode</MenuItem>
                <MenuItem value="sub_franchise">Sub Franchise</MenuItem>
              </Select>
            </FormControl>

            {isSC && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>States (Max 2)</InputLabel>
                <Select
                  multiple
                  label="States (Max 2)"
                  value={assignStates.map(String)}
                  onChange={(e) => {
                    const selected = Array.from(e.target.value || []).map((v) => String(v));
                    setAssignStates(selected);
                  }}
                  renderValue={(selected) => {
                    const names = (selected || []).map((id) => {
                      const s = sponsorStates.find((x) => String(x.id) === String(id));
                      return s ? s.name : id;
                    });
                    return names.join(", ");
                  }}
                >
                  {(sponsorStates || []).map((s) => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">
                  Select up to 2 states under sponsor.
                </Typography>
              </FormControl>
            )}

            {(isStateCat || isDC || isDistrictCat || isPC || isPincodeCat) && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>State (under Sponsor)</InputLabel>
                <Select
                  label="State (under Sponsor)"
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setAssignDistricts([]);
                    setSelectedDistrictAgency("");
                    setAssignPincodes([]);
                    setSelectedPincodeAgency("");
                  }}
                >
                  <MenuItem value="">-- Select --</MenuItem>
                  {(sponsorStates || []).map((s) => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {isDC && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Districts (Max 2)</InputLabel>
                <Select
                  multiple
                  label="Districts (Max 2)"
                  value={assignDistricts}
                  onChange={(e) => {
                    const arr = Array.from(e.target.value || []);
                    setAssignDistricts(arr);
                  }}
                  disabled={!selectedState}
                  renderValue={(selected) => (selected || []).join(", ")}
                >
                  {(districtOptions || []).map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">
                  Select up to 2 districts.
                </Typography>
              </FormControl>
            )}

            {(isDistrictCat || isPC || isPincodeCat || isSubFranchiseCat) && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>City/District (under Sponsor)</InputLabel>
                <Select
                  label="City/District (under Sponsor)"
                  value={selectedDistrictAgency}
                  onChange={(e) => {
                    setSelectedDistrictAgency(e.target.value);
                    setAssignPincodes([]);
                    setSelectedPincodeAgency("");
                  }}
                  disabled={!selectedState}
                >
                  <MenuItem value="">-- Select --</MenuItem>
                  {(districtOptions || []).map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {isPC && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Pincodes (Max 4)</InputLabel>
                <Select
                  multiple
                  label="Pincodes (Max 4)"
                  value={assignPincodes}
                  onChange={(e) => {
                    const arr = Array.from(e.target.value || []);
                    setAssignPincodes(arr);
                  }}
                  disabled={!selectedState || !selectedDistrictAgency}
                  renderValue={(selected) => (selected || []).join(", ")}
                >
                  {(pincodeOptions || []).map((pin) => (
                    <MenuItem key={pin} value={pin}>
                      {pin}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">
                  Select up to 4 pincodes.
                </Typography>
              </FormControl>
            )}

            {(isPincodeCat || isSubFranchiseCat) && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Pincode (under Sponsor)</InputLabel>
                <Select
                  label="Pincode (under Sponsor)"
                  value={selectedPincodeAgency}
                  onChange={(e) => setSelectedPincodeAgency(e.target.value)}
                  disabled={!selectedState || !selectedDistrictAgency}
                >
                  <MenuItem value="">-- Select --</MenuItem>
                  {(pincodeOptions || []).map((pin) => (
                    <MenuItem key={pin} value={pin}>
                      {pin}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </>
        );

      case "business":
        return (
          <>
            <TextField
              fullWidth
              label="Owner Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Business Name"
              name="business_name"
              value={formData.business_name}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BusinessIcon />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={mCatId}
                onChange={(e) => {
                  const id = String(e.target.value);
                  setMCatId(id);
                  try {
                    const nm = (mCategories || []).find((c) => String(c.id) === id)?.name || "";
                    setFormData((fd) => ({ ...fd, business_category: nm }));
                  } catch (_) {}
                }}
                required
              >
                <MenuItem value="">-- Select --</MenuItem>
                {(mCategories || []).map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }} disabled={!mCatId}>
              <InputLabel>Subcategory</InputLabel>
              <Select
                label="Subcategory"
                value={mSubcatId}
                onChange={(e) => setMSubcatId(String(e.target.value))}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {(mSubcategories || []).map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <MailIcon />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              sx={{ mb: 2 }}
              type="tel"
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              sx={{ mb: 2 }}
              multiline
              minRows={2}
              required
            />

            <TextField
              fullWidth
              label="Pincode"
              value={pincode}
              onChange={(e) => handlePincodeManualChange(e.target.value)}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
              helperText="Enter 6-digit pincode"
              sx={{ mb: 2 }}
              required
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Country</InputLabel>
              <Select label="Country" value={selectedCountry} onChange={handleCountryChange} required>
                {(countries || []).map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>State</InputLabel>
              <Select
                label="State"
                value={selectedState}
                onChange={handleStateChange}
                required
                disabled={!selectedCountry}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {(states || []).map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>District</InputLabel>
              <Select
                label="District"
                value={selectedCity}
                onChange={(e) => {
                  const name = e.target.value;
                  setSelectedCity(name);
                  try {
                    const norm = (v) => String(v || "").trim().toLowerCase();
                    const m = (cities || []).find(
                      (c) => norm(c?.name || c?.Name || c?.city || c?.City) === norm(name)
                    );
                    setSelectedCityId(m ? String(m.id) : "");
                  } catch (_) {}
                }}
                required
                disabled={!selectedState}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {Array.from(
                  new Set(
                    (cities || [])
                      .map((c) => c?.name || c?.Name || c?.city || c?.City)
                      .filter(Boolean)
                  )
                ).map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        );

      default:
        return null;
    }
  };

  // ---------------------------
  // Submit Handler (keeps logic)
  // ---------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // Required checks
    if (!formData.password) {
      setErrorMsg("Password is required");
      return;
    }
    if (formData.password !== confirmPassword) {
      setErrorMsg("Password and Confirm Password do not match");
      return;
    }

    const category = mapUIRoleToCategory();

    if (category === "employee" || category === "consumer") {
      if (!formData.phone) {
        setErrorMsg("Phone number is required for Consumer/Employee registration");
        return;
      }
    }

    if (category === "business") {
      if (!formData.email) {
        setErrorMsg("Email is required for business registration");
        return;
      }
      if (!formData.business_name) {
        setErrorMsg("Business Name is required");
        return;
      }
      if (!formData.business_category) {
        setErrorMsg("Business Category is required");
        return;
      }
      if (!formData.address) {
        setErrorMsg("Address is required");
        return;
      }
    }

    if (role === "agency" && !agencyLevel) {
      setErrorMsg("Select Agency Registration Type");
      return;
    }

    if (!sponsorId) {
      setErrorMsg("Sponsor Username is required");
      return;
    }

    if (sponsorValid === false) {
      setErrorMsg("Invalid Sponsor Username. Please correct the Sponsor ID.");
      return;
    }

    if (AGENCY_CATEGORIES.has(category) && !validateAgencyInputs()) {
      return;
    }

    // For non-agency, ensure location selections
    if (!AGENCY_CATEGORIES.has(category)) {
      if (!selectedCountry || !selectedState || !selectedCity || !pincode) {
        setErrorMsg("Please select Country, State, District and Pincode");
        return;
      }
    }

    // Resolve cityId strictly as a numeric PK before building payload
    let cityId = selectedCityId && /^\d+$/.test(String(selectedCityId)) ? Number(selectedCityId) : null;

    try {
      // fallback: try lookup by pincode if missing
      if (!cityId) {
        const pinNorm = String(pincode || "").replace(/\D/g, "");
        if (pinNorm.length === 6) {
          try {
            const pinResp = await API.get(`/location/pincode/${pinNorm}/`);
            const pb = pinResp?.data || {};
            if (pb?.city_id) cityId = Number(pb.city_id);
          } catch (_) {}
        }
      }

      // Build payload
      const payload = {
        password: formData.password,
        email: formData.email || "",
        full_name: formData.full_name || "",
        phone: formData.phone || "",
        sponsor_id: normalizeSponsor(sponsorId) || "",
        category,
      };

      if (!AGENCY_CATEGORIES.has(category)) {
        Object.assign(payload, {
          country: selectedCountry || null,
          state: selectedState || null,
          city: cityId ?? null,
          pincode,
          country_name: geoCountryName || "",
          state_name: geoStateName || "",
          city_name: geoCityName || "",
        });
      }

      if (category === "agency_state_coordinator") {
        payload.assign_states = assignStates.map((id) => Number(id)).filter(Boolean);
      } else if (category === "agency_state") {
        if (selectedState) payload.selected_state = Number(selectedState);
      } else if (category === "agency_district_coordinator") {
        if (selectedState) payload.selected_state = Number(selectedState);
        if (assignDistricts.length) payload.assign_districts = assignDistricts;
      } else if (category === "agency_district") {
        if (selectedState) payload.selected_state = Number(selectedState);
        if (selectedDistrictAgency) payload.selected_district = selectedDistrictAgency.trim();
      } else if (category === "agency_pincode_coordinator") {
        if (selectedState) payload.selected_state = Number(selectedState);
        if (selectedDistrictAgency) payload.selected_district = selectedDistrictAgency.trim();
        if (assignPincodes.length) payload.assign_pincodes = assignPincodes;
      } else if (category === "agency_pincode" || category === "agency_sub_franchise") {
        if (selectedState) payload.selected_state = Number(selectedState);
        if (selectedDistrictAgency) payload.selected_district = selectedDistrictAgency.trim();
        if (selectedPincodeAgency) payload.selected_pincode = selectedPincodeAgency.trim();
      }

      const submittedPassword = formData.password;

      if (category === "business") {
        // 1) Create login-enabled Business user
        const resp = await API.post("/accounts/register/", payload);
        const data = resp?.data || {};
        const uname = data.username || "(generated)";

        // 2) fire-and-forget: persist business profile
        (async () => {
          try {
            const brPayload = {
              full_name: formData.full_name || "",
              email: formData.email || "",
              phone: formData.phone || "",
              business_name: formData.business_name || "",
              business_category: formData.business_category || "",
              address: formData.address || "",
              sponsor_id: sponsorId || "",
              country: selectedCountry || null,
              state: selectedState || null,
              city: cityId ?? null,
              pincode,
              country_name: geoCountryName || "",
              state_name: geoStateName || "",
              city_name: geoCityName || "",
            };
            await API.post("/business/register/", brPayload);
          } catch (_) {}
        })();

        setSuccessMsg(`Welcome to Trikonekt!\nUsername: ${uname}\nPassword: ${submittedPassword}`);
        setRegSuccessText({ username: uname, password: submittedPassword });
        setRegSuccessOpen(true);
      } else {
        const resp = await API.post("/accounts/register/", payload);
        const data = resp?.data || {};
        const uname = data.username || "(generated)";
        setSuccessMsg(`Welcome to Trikonekt!\nUsername: ${uname}\nPassword: ${submittedPassword}`);
        setRegSuccessText({ username: uname, password: submittedPassword });
        setRegSuccessOpen(true);
      }

      // reset fields
      setFormData({
        password: "",
        email: "",
        full_name: "",
        phone: "",
        business_name: "",
        business_category: "",
        address: "",
      });
      setConfirmPassword("");
      setSelectedCountry("");
      setSelectedState("");
      setSelectedCity("");
      setSelectedCityId("");
      setPincode("");
      setStates([]);
      setCities([]);

      setAssignStates([]);
      setAssignDistricts([]);
      setSelectedDistrictAgency("");
      setAssignPincodes([]);
      setSelectedPincodeAgency("");
    } catch (err) {
      const msg = err?.response?.data ? JSON.stringify(err.response.data) : "Registration failed!";
      setErrorMsg(typeof msg === "string" ? msg : String(msg));
    }
  };

  // ---------------------------
  // UI Components
  // ---------------------------
  const StepperMini = ({ active = 2 }) => {
    const steps = ["Category", "Sponsor", "Details", "Submit"];
    return (
      <Box sx={{ mt: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          {steps.map((s, idx) => {
            const num = idx + 1;
            const isActive = num <= active;
            return (
              <Typography
                key={s}
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: isActive ? "#0f172a" : "#94a3b8",
                }}
              >
                {s}
              </Typography>
            );
          })}
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, (active / 4) * 100)}
          sx={{
            height: 7,
            borderRadius: 99,
            bgcolor: "#eef2ff",
            "& .MuiLinearProgress-bar": {
              borderRadius: 99,
              background: "linear-gradient(90deg,#1976d2 0%,#42a5f5 100%)",
            },
          }}
        />
      </Box>
    );
  };

  const CategoryCard = ({ title, subtitle, icon, value }) => {
    const selected = role === value;
    return (
      <Paper
        onClick={() => {
          setRole(value);
          setErrorMsg("");
          setSuccessMsg("");
          setStep(2);
        }}
        elevation={0}
        sx={{
          p: 2.2,
          borderRadius: 3,
          cursor: "pointer",
          border: selected ? "2px solid #1976d2" : "1px solid #e2e8f0",
          background: selected
            ? "linear-gradient(180deg,#f0f7ff 0%,#ffffff 100%)"
            : "linear-gradient(180deg,#ffffff 0%,#ffffff 100%)",
          transition: "all 0.2s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 12px 30px rgba(2,6,23,0.08)",
          },
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 99,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(180deg,#eaf6ff 0%,#ffffff 100%)",
            border: "1px solid #e2e8f0",
            mb: 1.5,
          }}
        >
          {icon}
        </Box>

        <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>{title}</Typography>
        <Typography sx={{ fontSize: 13, color: "#64748b", mt: 0.5 }}>{subtitle}</Typography>

        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
          <ArrowForwardIosIcon sx={{ fontSize: 16, color: "#94a3b8" }} />
        </Box>
      </Paper>
    );
  };

  // ---------------------------
  // Top Bar (same for both steps)
  // ---------------------------
  const TopBar = () => (
    <AppBar
      position="sticky"
      color="default"
      elevation={0}
      sx={{
        backgroundColor: "#ffffff",
        color: "#0f172a",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <Toolbar sx={{ gap: 1.5 }}>
        <IconButton
          edge="start"
          color="inherit"
          onClick={() => {
            if (step === 2) return setStep(1);
            if (window.history.length > 1) window.history.back();
            else navigate("/");
          }}
        >
          <ArrowBackIcon />
        </IconButton>

        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          <img src={LOGO} alt="Trikonekt" style={{ height: 28 }} />
          <Typography sx={{ fontWeight: 900, letterSpacing: 0.3 }}>TRIKONEKT</Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <IconButton color="inherit">
          <HelpOutlineIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );

  // ---------------------------
  // Sponsor UI (compact like mock)
  // ---------------------------
  const SponsorBox = () => (
    <Box sx={{ mt: 2 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 14, color: "#0f172a", mb: 1 }}>
        Sponsor
      </Typography>

      <TextField
        fullWidth
        label="Sponsor Username"
        value={sponsorId}
        onChange={(e) => {
          setSponsorId(e.target.value);
          setSponsorValid(null);
        }}
        disabled={sponsorLocked}
        sx={{ mb: 1.2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <HomeIcon />
            </InputAdornment>
          ),
        }}
      />

      {sponsorChecking && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Validating sponsor”¦
          </Typography>
        </Box>
      )}

      {sponsorValid === true && (
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: 2,
            border: "1px solid #bbf7d0",
            background: "linear-gradient(180deg,#f0fdf4 0%,#ffffff 100%)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <CheckCircleIcon sx={{ color: "#16a34a", fontSize: 18 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 13, color: "#166534" }}>
              Sponsor verified: {sponsorDisplay.username || sponsorId}
            </Typography>
          </Box>

          <Typography variant="body2" sx={{ color: "#0f172a" }}>
            <b>Sponsor ID:</b> {sponsorDisplay.username || sponsorId}
          </Typography>
          <Typography variant="body2" sx={{ color: "#0f172a" }}>
            <b>Name:</b> {sponsorDisplay.name || ""}
          </Typography>
          <Typography variant="body2" sx={{ color: "#0f172a" }}>
            <b>Pincode:</b> {sponsorDisplay.pincode || ""}
          </Typography>
        </Paper>
      )}

      {sponsorValid === false && (
        <Alert severity="error" sx={{ mt: 1 }}>
          Invalid Sponsor ID. Please correct the Sponsor Username.
        </Alert>
      )}
    </Box>
  );

  // ---------------------------
  // Sticky bottom CTA (mock style)
  // ---------------------------
  const StickyCTA = ({ label = "Continue", onClick, disabled }) => (
    <Box
      sx={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        mt: 2,
        pb: 2,
        pt: 1.5,
        background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 40%)",
      }}
    >
      <Button
        fullWidth
        variant="contained"
        onClick={onClick}
        disabled={disabled}
        sx={{
          py: 1.25,
          fontWeight: 900,
          borderRadius: 2,
          textTransform: "none",
          background: "linear-gradient(90deg,#1976d2 0%,#42a5f5 100%)",
          boxShadow: "0 10px 25px rgba(25,118,210,0.22)",
          "&:active": { transform: "translateY(1px)" },
        }}
      >
        {label}
      </Button>
    </Box>
  );

  // ---------------------------
  // Screen 1: Category Selection
  // ---------------------------
  const ScreenCategory = () => (
    <Container maxWidth="sm" sx={{ py: { xs: 3, md: 6 } }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          border: "1px solid #e2e8f0",
          p: { xs: 2.5, sm: 3.5 },
          background: "linear-gradient(180deg,#ffffff 0%,#ffffff 100%)",
        }}
      >
        <Chip
          label="Step 1"
          sx={{
            fontWeight: 900,
            borderRadius: 2,
            bgcolor: "#eef2ff",
            color: "#1e293b",
            mb: 1.5,
          }}
        />

        <Typography sx={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
          Select Category
        </Typography>
        <Typography sx={{ fontSize: 14, color: "#64748b", mt: 0.5 }}>
          Choose your account type to register.
        </Typography>

        <Box sx={{ mt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <CategoryCard
                title="Consumer"
                subtitle="For individual users"
                value="user"
                icon={<PersonIcon sx={{ color: "#1976d2" }} />}
              />
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" sx={{ color: "#64748b", textAlign: "center" }}>
            Already have an account?{" "}
            <Link
              onClick={() => navigate(`/auth/login/${role}`)}
              sx={{ fontWeight: 900, cursor: "pointer" }}
            >
              Login
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );

  // ---------------------------
  // Screen 2: Registration Form
  // ---------------------------
  const ScreenForm = () => (
    <Container maxWidth="sm" sx={{ py: { xs: 2.5, md: 6 } }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          border: "1px solid #e2e8f0",
          p: { xs: 2.5, sm: 3.5 },
          background: "linear-gradient(180deg,#ffffff 0%,#ffffff 100%)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Avatar
            src={LOGO}
            alt="Trikonekt"
            sx={{ width: 40, height: 40, bgcolor: "transparent" }}
          />
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
              {prettyRole(role)} Registration
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#64748b" }}>
              Complete your details to continue.
            </Typography>
          </Box>
        </Box>

        <StepperMini active={2} />

        {errorMsg && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMsg}
          </Alert>
        )}
        {successMsg && (
          <Alert severity="success" sx={{ mt: 2, whiteSpace: "pre-line" }}>
            {successMsg}
          </Alert>
        )}

        <SponsorBox />

        <Divider sx={{ my: 2.5 }} />

        <Box sx={{ textAlign: "left" }}>
          <Typography sx={{ fontWeight: 900, fontSize: 14, mb: 1.25, color: "#0f172a" }}>
            Details
          </Typography>

          {renderRegistrationFields()}

          <Typography sx={{ fontWeight: 900, fontSize: 14, mt: 2, mb: 1, color: "#0f172a" }}>
            Security
          </Typography>

          <TextField
            fullWidth
            name="password"
            value={formData.password}
            label="Password"
            type={showPassword ? "text" : "password"}
            onChange={handleChange}
            sx={{ mb: 2 }}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((p) => !p)} size="small">
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            fullWidth
            label="Confirm Password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            sx={{ mb: 1 }}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirm((p) => !p)} size="small">
                    {showConfirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <StickyCTA
            label="Register"
            onClick={handleSubmit}
            disabled={sponsorValid === false || sponsorChecking}
          />

          <Typography variant="body2" align="center" sx={{ color: "#64748b", mt: 1 }}>
            Already have an account?{" "}
            <Link
              onClick={() => navigate(`/auth/login/${role}`)}
              sx={{ fontWeight: 900, cursor: "pointer" }}
            >
              Login
            </Link>
          </Typography>
        </Box>
      </Paper>

      {/* Registration success popup */}
      <Dialog open={regSuccessOpen} onClose={() => setRegSuccessOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Registration Successful</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>
            {`Welcome to Trikonekt!\n\nUsername: ${regSuccessText.username}\nPassword: ${regSuccessText.password}`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegSuccessOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              setRegSuccessOpen(false);
              navigate(`/auth/login/${role}`, { replace: true });
            }}
          >
            Go to Login
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: {
          xs: "linear-gradient(180deg,#fafcff 0%,#ffffff 100%)",
          md: "linear-gradient(135deg,#eaf6ff 0%,#ffffff 70%)",
        },
      }}
    >
      <TopBar />

      <Box sx={{ flex: 1 }}>
        {step === 1 ? <ScreenCategory /> : <ScreenForm />}
      </Box>

      <Box sx={{ py: 2, textAlign: "center" }}>
        <Typography variant="caption" sx={{ color: "#94a3b8" }}>
          © {new Date().getFullYear()} Trikonekt
        </Typography>
      </Box>
    </Box>
  );
};

export default RegisterV2;


