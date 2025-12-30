// Login.jsx — Final polished wireframe UI (single-file).
// NOTE: This file PRESERVES your original logic (API calls, geolocation, registration, dialogs).
// Styling is done via MUI sx props. Requires @mui/material and @mui/icons-material v7.

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Autocomplete,
  CircularProgress,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
  Checkbox,
  FormControlLabel,
  Link,
} from "@mui/material";

import {
  AccountCircle,
  Lock,
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
  Store as StoreIcon,
  Work as WorkIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  Mail as MailIcon,
  Phone as PhoneIcon,
  CheckCircle as CheckCircleIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";

import { useNavigate, useLocation, useParams } from "react-router-dom";
import API from "../../api/api";
import LOGO from "../../assets/TRIKONEKT.png";

const Login = () => {
  // === LOGIC STATES (kept from original) ===
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [role, setRole] = useState("user"); // user | agency | employee | business
  const ALLOWED_ROLES = ["user", "agency", "employee", "business"];
  const { role: roleParam } = useParams();
  const lockedRole = ALLOWED_ROLES.includes(String(roleParam || "").toLowerCase())
    ? String(roleParam).toLowerCase()
    : null;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [sponsorId, setSponsorId] = useState("");
  const [agencyLevel, setAgencyLevel] = useState("");


  // If a role is locked via route param, force-select it
  useEffect(() => {
    if (lockedRole && role !== lockedRole) {
      setRole(lockedRole);
    }
  }, [lockedRole]);

  // If already authenticated:
  // - When a role is locked via the URL, redirect ONLY if a session exists for that role.
  // - When no role is locked (generic auth routes), redirect to the first available session.
  // - When in Register mode, do NOT auto-redirect, even if another session exists.
  useEffect(() => {
    try {
      const pathNow = location.pathname || "";
      if (/^\/(auth\/login|login)(\/|$)/i.test(pathNow)) return;
      const qMode = new URLSearchParams(location.search || "").get("mode");
      if (mode === "register" || String(qMode).toLowerCase() === "register") return;
      const mapLockedToNs = (r) => {
        const rl = String(r || "").toLowerCase();
        return ["user", "agency", "employee", "business"].includes(rl) ? rl : null;
      };
      const preferredNs = mapLockedToNs(lockedRole);
      if (preferredNs) {
        const has =
          localStorage.getItem(`token_${preferredNs}`) ||
          sessionStorage.getItem(`token_${preferredNs}`);
        if (has) {
          const to =
            preferredNs === "admin" ? "/admin/dashboard" : `/${preferredNs}/dashboard`;
          navigate(to, { replace: true });
        }
      } else {
        const nsCandidates = ["admin", "agency", "employee", "user"];
        const found = nsCandidates.find(
          (ns) =>
            localStorage.getItem(`token_${ns}`) ||
            sessionStorage.getItem(`token_${ns}`)
        );
        if (found) {
          const to = found === "admin" ? "/admin/dashboard" : `/${found}/dashboard`;
          navigate(to, { replace: true });
        }
      }
    } catch {}
  }, [mode, lockedRole, navigate, location.search]);

  // Redirect legacy /login?mode=register[&role=...] links to the role-scoped register route
  // This avoids any admin-session auto-redirects that can occur on the generic /login page.
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || "");
      const qMode = String(params.get("mode") || params.get("category") || "").toLowerCase();
      if (qMode === "register") {
        const r = String(params.get("role") || role || "user").toLowerCase();
        const sponsor =
          params.get("sponsor") ||
          params.get("sponsor_id") ||
          params.get("agencyid") ||
          params.get("ref");
        const qs = sponsor ? `?sponsor=${encodeURIComponent(sponsor)}` : "";
        navigate(`/auth/register/${r}${qs}`, { replace: true });
      }
    } catch {}
  }, [location.search, navigate]);

  // Read role and mode (aka "category") from query string to preselect UI
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const qMode = (params.get("mode") || params.get("category") || "").toLowerCase();
      if (qMode === "register") setMode("register");
      else if (qMode === "login") setMode("login");
      const qRole = (params.get("role") || "").toLowerCase();
      if (["user", "agency", "employee", "business"].includes(qRole)) {
        setRole(qRole);
      }
      // If sponsor exists and user came for registration, prefill sponsor
      const s =
        params.get("sponsor") ||
        params.get("sponsor_id") ||
        params.get("agencyid") ||
        params.get("ref");
      if (s && qMode === "register") {
        setSponsorId(s);
      }
    } catch {}
  }, [location.search]);

  // Auto-select Sub Franchise for agency register links with sponsor
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || "");
      const s =
        params.get("sponsor") ||
        params.get("sponsor_id") ||
        params.get("agencyid") ||
        params.get("ref");
      if (mode === "register" && role === "agency" && s && !agencyLevel) {
        setAgencyLevel("sub_franchise");
      }
    } catch {}
  }, [mode, role, location.search, agencyLevel]);

  // Ensure Register tab on /auth/register/* routes
  useEffect(() => {
    try {
      if (/\/auth\/register\//i.test(location.pathname || "")) {
        setMode("register");
      }
    } catch {}
  }, [location.pathname]);


  const handleModeChange = () => setMode(mode === "login" ? "register" : "login");
  const handleRoleChange = (_, val) => {
    if (lockedRole) return;
    if (val) setRole(val);
  };
  const handleRegisterNav = () => {
    const s = normalizeSponsor(sponsorId);
    const qs = s ? `?sponsor=${encodeURIComponent(s)}` : "";
    navigate(`/auth/register-v2/${role}${qs}`);
  };

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    full_name: "",
    phone: "",
    business_name: "",
    business_category: "",
    address: "",
  });
  const handleChange = (e) =>
    setFormData((fd) => ({ ...fd, [e.target.name]: e.target.value }));

  // Location/cascading state (kept)
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [pincode, setPincode] = useState("");

  // Smart location
  const [autoLoading, setAutoLoading] = useState(true);
  const [accuracy, setAccuracy] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branchDisabled, setBranchDisabled] = useState(false);
  const [stateVal, setStateVal] = useState("");
  const [countryVal, setCountryVal] = useState("");
  const [cityOptions, setCityOptions] = useState([]);

  // Geo fields
  const [geoCountryName, setGeoCountryName] = useState("");
  const [geoCountryCode, setGeoCountryCode] = useState("");
  const [geoStateName, setGeoStateName] = useState("");
  const [geoCityName, setGeoCityName] = useState("");
  const geoRequestedRef = useRef(false);


  // Live Sponsor validation state
  const [sponsorChecking, setSponsorChecking] = useState(false);
  const [sponsorValid, setSponsorValid] = useState(null); // null unknown, true valid, false invalid
  const [sponsorDisplay, setSponsorDisplay] = useState({ name: "", pincode: "", username: "" });

  // Non-agency (Consumer/Employee) sponsor-driven pincode selection
  const [sponsorConsumerPincodes, setSponsorConsumerPincodes] = useState([]);
  const [selectedConsumerPincode, setSelectedConsumerPincode] = useState("");

  // Non-agency: sponsor-driven State/District selection
  const [consumerSponsorStates, setConsumerSponsorStates] = useState([]);
  const [consumerSponsorDistricts, setConsumerSponsorDistricts] = useState([]);
  const [consumerSelectedState, setConsumerSelectedState] = useState("");
  const [consumerSelectedDistrict, setConsumerSelectedDistrict] = useState("");
const [consumerDistrictPincodes, setConsumerDistrictPincodes] = useState([]);
const [consumerPinsByState, setConsumerPinsByState] = useState([]);
// Non-agency (Consumer/Employee/Merchant) district->pincode options via Country/State/District selects
const [nonAgencyDistrictPincodes, setNonAgencyDistrictPincodes] = useState([]);
const [pinByDistrictLoadingNA, setPinByDistrictLoadingNA] = useState(false);

  // Normalize sponsor input to avoid passing URLs or malformed strings to the API
  const normalizeSponsor = (val) => {
    try {
      const s = String(val || "").trim();
      if (!s) return "";
      // If value looks like a URL or contains query, try to extract ?sponsor= param
      if (s.includes("://") || s.includes("?") || s.includes("=") || s.includes("/")) {
        try {
          const u = new URL(s, window.location.origin);
          const q = new URLSearchParams(u.search);
          const inner = q.get("sponsor");
          if (inner) return normalizeSponsor(inner); // recurse once to clean
        } catch (_) {
          // Not a full URL, attempt to parse query portion manually
          const idx = s.indexOf("?");
          if (idx >= 0) {
            const qs = s.slice(idx + 1);
            const params = new URLSearchParams(qs);
            const inner = params.get("sponsor");
            if (inner) return normalizeSponsor(inner);
          }
        }
      }
      // Keep only token-like characters; typical IDs like TRDC178720
      const token = s.match(/[A-Za-z0-9_-]+/g)?.join("") || "";
      return token;
    } catch {
      return "";
    }
  };
  const [remember, setRemember] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpUsername, setFpUsername] = useState("");
  const [fpNewPassword, setFpNewPassword] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  // Success popup for registration
  const [regSuccessOpen, setRegSuccessOpen] = useState(false);
  const [regSuccessText, setRegSuccessText] = useState({ username: "", password: "" });

  // Load countries
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const res = await API.get("/location/countries/");
        setCountries(res.data || []);
      } catch (err) {
        console.error("Failed to load countries", err);
      }
    };
    loadCountries();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("remember_username");
    if (saved) {
      setFormData((fd) => ({ ...fd, username: saved }));
      setRemember(true);
    }
  }, []);

  const loadStates = async (countryId) => {
    try {
      const res = await API.get("/location/states/", { params: { country: countryId } });
      setStates(res.data || []);
    } catch (err) {
      console.error("Failed to load states", err);
    }
  };

  const loadCities = async (stateId) => {
    try {
      const res = await API.get("/location/cities/", { params: { state: stateId } });
      setCities(res.data || []);
    } catch (err) {
      console.error("Failed to load cities", err);
    }
  };

  const handleCountryChange = (e) => {
    const value = e.target.value;
    setSelectedCountry(value);
    setSelectedState("");
    setSelectedCity("");
    setStates([]);
    setCities([]);
    setPincode("");
    if (value) loadStates(value);
  };

  const handleStateChange = (e) => {
    const value = e.target.value;
    setSelectedState(value);
    setSelectedCity("");
    setCities([]);
    setPincode("");
    if (value) loadCities(value);
  };

  const handleCityChange = (e) => {
    const value = e.target.value;
    setSelectedCity(value);
    setPincode("");
  };

  // Pincode lookup
  const fetchFromBackendPin = async (code) => {
    const pin = (code || "").replace(/\D/g, "");
    if (pin.length !== 6) return;
    try {
      const resp = await API.get(`/location/pincode/${pin}/`);
      const payload = resp?.data || {};
      const detectedCity = payload.city || payload.district || "";
      const detectedState = payload.state || "";
      const detectedCountry = payload.country || "";

      if (detectedCity) setGeoCityName(detectedCity);
      if (detectedState) {
        setStateVal(detectedState);
        setGeoStateName(detectedState);
        // Auto-select State for Consumer/Employee registration under Sponsor after PIN selection
        if (mode === "register" && (role === "user" || role === "employee")) {
          const match = (consumerSponsorStates || []).find(
            (s) => String(s?.name || "").toLowerCase() === String(detectedState).toLowerCase()
          );
          if (match) {
            setConsumerSelectedState(String(match.id));
          }
        }
      }
      if (detectedCountry) {
        setCountryVal(detectedCountry);
        setGeoCountryName(detectedCountry);
      }
    } catch (e) {
      // ignore lookup errors
    }
  };

  useEffect(() => {
    if (mode !== "register" || role === "agency") return;
    const code = (pincode || "").trim();
    if (code.replace(/\D/g, "").length === 6) {
      fetchFromBackendPin(code);
    }
  }, [pincode, mode, role]);

  // Auto-fetch branches when pincode reaches 6 digits for registration
  useEffect(() => {
    if (mode !== "register" || role === "agency") return;
    if (pincode.length === 6) {
      handleFetchBranches();
    }
  }, [pincode, mode, role]);

  // Sponsor from URL (priority: agencyid, sponsor, sponsor_id, ref)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw =
        params.get("agencyid") ||
        params.get("sponsor") ||
        params.get("sponsor_id") ||
        params.get("ref");
      const norm = normalizeSponsor(raw || "");
      if (norm) setSponsorId(norm);
    } catch {}
  }, []);

  // Auto detect location
  useEffect(() => {
    // Only run geolocation during Register and when not Agency/Business
    if (mode !== "register" || role === "agency" || role === "business") {
      setManualMode(true);
      setAutoLoading(false);
      return;
    }

    // Prevent duplicate calls (e.g., React StrictMode in dev)
    if (geoRequestedRef.current) {
      setAutoLoading(false);
      return;
    }
    geoRequestedRef.current = true;

    let cancelled = false;

    if (!navigator.geolocation) {
      setManualMode(true);
      setAutoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy: acc } = pos.coords;
          if (cancelled) return;

          setAccuracy(acc);

          const r = await API.get("/location/reverse/", {
            params: { lat: latitude, lon: longitude },
          });
          const rb = r?.data || {};

          const detectedPin = rb.pincode || "";
          const detectedState = rb.state || "";
          const detectedCountry = rb.country || "";
          const detectedCity = rb.city || rb.district || "";

          setPincode((detectedPin || "").replace(/\D/g, "").slice(0, 6));
          setStateVal(detectedState);
          setCountryVal(detectedCountry);
          setGeoCityName(detectedCity);

          setGeoStateName(detectedState);
          setGeoCountryName(detectedCountry);

          const POOR_ACCURACY_THRESHOLD = 800;
          setManualMode(!detectedPin || (typeof acc === "number" && acc > POOR_ACCURACY_THRESHOLD));
        } catch (e) {
          console.error("Reverse geocoding failed:", e);
          setManualMode(true);
        } finally {
          if (!cancelled) setAutoLoading(false);
        }
      },
      (error) => {
        console.error("Auto-detect error:", error.message);
        setManualMode(true);
        setAutoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => {
      cancelled = true;
    };
  }, [mode, role]);

  // Fetch post offices
  const handleFetchBranches = async () => {
    const pin = (pincode || "").replace(/\D/g, "");
    setBranchLoading(true);
    setSelectedBranch(null);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const resp = await API.get(`/location/pincode/${pin}/`);
      const payload = resp?.data || {};
      const list = Array.isArray(payload.post_offices) ? payload.post_offices : [];
      setBranches(list);

      const detectedCity = payload.city || payload.district || "";
      const detectedState = payload.state || "";
      const detectedCountry = payload.country || "";
      if (detectedCity) setGeoCityName(detectedCity);
      if (detectedState) {
        setStateVal(detectedState);
        setGeoStateName(detectedState);
      }
      if (detectedCountry) {
        setCountryVal(detectedCountry);
        setGeoCountryName(detectedCountry);
      }

      if (!detectedCity && list.length > 0) {
        const firstDistrict = list.find((po) => po?.district)?.district || "";
        if (firstDistrict) setGeoCityName(firstDistrict);
      }

      if (list.length > 0) {
        const b = list[0];
        setSelectedBranch(b);
        setBranchDisabled(true);
        const st = b.state || b.State || detectedState || "";
        const ct = b.country || b.Country || detectedCountry || "India";
        setStateVal(st);
        setCountryVal(ct);
        setGeoStateName(st);
        setGeoCountryName(ct);
        if (!detectedCity && (b.district || b.District)) {
          setGeoCityName(b.district || b.District);
        }
      }

      if (list.length === 0) {
        setErrorMsg(payload?.message || "No post offices found for this pincode.");
      } else {
        const cityPart = detectedCity ? detectedCity : "";
        const statePart = detectedState ? (cityPart ? `, ${detectedState}` : detectedState) : "";
        setSuccessMsg(`Detected ${cityPart}${statePart}. ${list.length} branches found.`);
      }
    } catch (e) {
      alert("Failed to fetch branches. Please try again.");
      setBranches([]);
    } finally {
      setBranchLoading(false);
    }
  };

  const handleBranchSelect = (_, branch) => {
    setSelectedBranch(branch);
    if (branch) {
      const st = branch.state || branch.State || "";
      const ct = branch.country || branch.Country || "India";
      setStateVal(st);
      setCountryVal(ct);
      setGeoStateName(st);
      setGeoCountryName(ct);
      if (branch.district || branch.District) setGeoCityName(branch.district || branch.District);
    }
  };

  const handlePincodeChange = (val) => {
    const next = (val || "").replace(/\D/g, "").slice(0, 6);
    setPincode(next);
    setBranches([]);
    setSelectedBranch(null);
    setBranchDisabled(false);
    setGeoCityName("");
  };

  const handlePasswordReset = async () => {
    const username = fpUsername || formData.username;
    const newPassword = fpNewPassword;
    if (!username || !newPassword) {
      alert("Please provide username and new password.");
      return;
    }
    try {
      setFpLoading(true);
      const res = await API.post("/accounts/password/reset/", {
        username,
        new_password: newPassword,
      });
      alert(res?.data?.detail || "Password reset successful.");
      setForgotOpen(false);
      setFpUsername("");
      setFpNewPassword("");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : "Password reset failed!");
      alert(msg);
    } finally {
      setFpLoading(false);
    }
  };

  const isLogin = true;

  // Load sponsor-constrained pincodes for Consumer/Employee registration
  useEffect(() => {
    // Only in Register mode for user/employee (non-agency)
    if (mode !== "register" || !(role === "user" || role === "employee")) {
      setSponsorConsumerPincodes([]);
      return;
    }
    const s = normalizeSponsor(sponsorId);
    if (!s) {
      setSponsorConsumerPincodes([]);
      return;
    }
    (async () => {
      try {
        // Prefer level=state (backend may include pincodes along with states), fallback to level=pincode
        let pins = [];
        try {
          const respState = await API.get("/accounts/regions/by-sponsor/", {
            params: { sponsor: s, level: "state" },
          });
          pins = respState?.data?.pincodes || [];
          setConsumerPinsByState(respState?.data?.pins_by_state || []);
        } catch (_) {
          // ignore and fallback below
        }
        if (!Array.isArray(pins) || pins.length === 0) {
          const respPin = await API.get("/accounts/regions/by-sponsor/", {
            params: { sponsor: s, level: "pincode" },
          });
          pins = respPin?.data?.pincodes || [];
          setConsumerPinsByState([]);
        }
        setSponsorConsumerPincodes(pins);
        // keep selected pincode only if still valid
        setSelectedConsumerPincode((prev) => (pins.includes(prev) ? prev : ""));
      } catch {
        setSponsorConsumerPincodes([]);
      }
    })();
  }, [mode, role, sponsorId]);

  // Fetch sponsor-constrained states for Consumer/Employee
  useEffect(() => {
    if (mode !== "register" || !(role === "user" || role === "employee")) {
      setConsumerSponsorStates([]);
      return;
    }
    const s = normalizeSponsor(sponsorId);
    if (!s) {
      setConsumerSponsorStates([]);
      return;
    }
    (async () => {
      try {
        const resp = await API.get("/accounts/regions/by-sponsor/", {
          params: { sponsor: s, level: "state" },
        });
        const states = resp?.data?.states || [];
        setConsumerSponsorStates(states);
        setConsumerPinsByState(resp?.data?.pins_by_state || []);
        setConsumerSelectedState((prev) =>
          states.some((x) => String(x.id) === String(prev)) ? prev : ""
        );
      } catch {
        setConsumerSponsorStates([]);
      }
    })();
  }, [mode, role, sponsorId]);

  // Fetch sponsor-constrained districts for selected consumer state
  useEffect(() => {
    if (mode !== "register" || !(role === "user" || role === "employee")) {
      setConsumerSponsorDistricts([]);
      return;
    }
    const s = normalizeSponsor(sponsorId);
    if (!s || !consumerSelectedState) {
      setConsumerSponsorDistricts([]);
      return;
    }
    (async () => {
      try {
        const resp = await API.get("/accounts/regions/by-sponsor/", {
          params: { sponsor: s, level: "district", state_id: consumerSelectedState },
        });
        const districts = resp?.data?.districts || [];
        setConsumerSponsorDistricts(districts);
        setConsumerSelectedDistrict((prev) =>
          districts.some(
            (d) =>
              String(d.state_id) === String(consumerSelectedState) &&
              String(d.district).toLowerCase() === String(prev).toLowerCase()
          )
            ? prev
            : ""
        );
      } catch {
        setConsumerSponsorDistricts([]);
      }
    })();
  }, [mode, role, sponsorId, consumerSelectedState]);

  // Load district pincodes for selected consumer district/state
  useEffect(() => {
    if (mode !== "register" || !(role === "user" || role === "employee")) {
      setConsumerDistrictPincodes([]);
      return;
    }
    if (!consumerSelectedDistrict) {
      setConsumerDistrictPincodes([]);
      return;
    }
    (async () => {
      try {
        const resp = await API.get("/location/pincodes/by-district/", {
          params: { district_name: consumerSelectedDistrict, state_id: consumerSelectedState },
        });
        const pins = resp?.data?.pincodes || [];
        setConsumerDistrictPincodes(pins);
        setSelectedConsumerPincode((prev) => (pins.includes(prev) ? prev : ""));
      } catch {
        setConsumerDistrictPincodes([]);
      }
    })();
  }, [mode, role, consumerSelectedDistrict, consumerSelectedState]);



  // Live Sponsor validation (register): verify sponsor exists and show identity
  useEffect(() => {
    if (mode !== "register") {
      setSponsorValid(null);
      return;
    }
    const s = normalizeSponsor(sponsorId);
    if (!s) {
      setSponsorValid(null);
      setSponsorDisplay({ name: "", pincode: "", username: "" });
      return;
    }
    setSponsorChecking(true);
    const t = setTimeout(async () => {
      let exists = false;
      let name = "";
      let pcode = "";
      let uname = s;
      try {
        // Try hierarchy endpoint to fetch user basic info
        try {
          const h = await API.get("/accounts/hierarchy/", { params: { username: s } });
          const u = h?.data?.user || h?.data || {};
          if (u && u.username) {
            exists = true;
            uname = u.username;
            name = u.full_name || "";
            pcode = u.pincode || "";
          }
        } catch (_) {}
        // Fallback: regions/by-sponsor existence check
        if (!exists) {
          try {
            await API.get("/accounts/regions/by-sponsor/", { params: { sponsor: s, level: "state" } });
            exists = true;
          } catch (_) {}
        }
      } finally {
        setSponsorValid(exists);
        setSponsorDisplay({ name, pincode: pcode, username: uname });
        setSponsorChecking(false);
      }
    }, 450);
    return () => {
      setSponsorChecking(false);
      clearTimeout(t);
    };
  }, [mode, sponsorId]);

  // Effective pincode options for consumer/employee (intersect when both available)
  // Non-agency: load pincodes when State and District are selected
  useEffect(() => {
    if (role === "agency") {
      setNonAgencyDistrictPincodes([]);
      return;
    }
    if (!selectedState || !selectedCity) {
      setNonAgencyDistrictPincodes([]);
      return;
    }
    setPinByDistrictLoadingNA(true);
    (async () => {
      try {
        const resp = await API.get("/location/pincodes/by-district/", {
          params: { district_name: selectedCity, state_id: selectedState },
        });
        const pins = resp?.data?.pincodes || [];
        setNonAgencyDistrictPincodes(pins);
        // Clear pincode if it is no longer valid for the selected district
        setPincode((prev) => (pins.includes(prev) ? prev : ""));
      } catch {
        setNonAgencyDistrictPincodes([]);
      } finally {
        setPinByDistrictLoadingNA(false);
      }
    })();
  }, [role, selectedCity, selectedState]);

const pincodeOptionsConsumer = useMemo(() => {
    return Array.isArray(sponsorConsumerPincodes) ? sponsorConsumerPincodes : [];
  }, [sponsorConsumerPincodes]);

  // helpers unchanged
  const onlyDigits = (s) => (s || "").replace(/\D/g, "");
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
        return null;
    }
  };
  const mapUIRoleToCategory = () => {
    if (role === "business") return "business";
    if (role === "employee") return "employee";
    if (role === "user") return "consumer";
    if (role === "agency") return mapAgencyLevelToCategory(agencyLevel) || "agency_state";
    return "consumer";
  };

  // =========================
  // Agency hierarchy additions
  // =========================

  const AGENCY_CATEGORIES = useMemo(
    () => new Set([
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
  const isAgency = role === "agency";
  const currentCategory = mapUIRoleToCategory();
  const isSC = currentCategory === "agency_state_coordinator";
  const isStateCat = currentCategory === "agency_state";
  const isDC = currentCategory === "agency_district_coordinator";
  const isDistrictCat = currentCategory === "agency_district";
  const isPC = currentCategory === "agency_pincode_coordinator";
  const isPincodeCat = currentCategory === "agency_pincode";
  const isSubFranchiseCat = currentCategory === "agency_sub_franchise";

  // Default Country to India for Sub Franchise and load states
  useEffect(() => {
    if (!isSubFranchiseCat) return;
    if (!selectedCountry && Array.isArray(countries) && countries.length) {
      const india = countries.find((c) => /india/i.test(c?.name || ""));
      const defaultId = india ? String(india.id) : String(countries[0].id);
      setSelectedCountry(defaultId);
      if (defaultId) {
        (async () => {
          try { await loadStates(defaultId); } catch {}
        })();
      }
    }
  }, [isSubFranchiseCat, selectedCountry, countries]);

  // Region inputs and options for agency flow
  const [allStatesList, setAllStatesList] = useState([]); // [{id,name}] for SC
  const [sponsorStates, setSponsorStates] = useState([]); // [{id,name}]
  const [sponsorDistricts, setSponsorDistricts] = useState([]); // [{state_id, state, district}]
  const [sponsorPincodes, setSponsorPincodes] = useState([]); // ["585103", ...]
  const [districtPincodes, setDistrictPincodes] = useState([]);
  const [pinByDistrictLoading, setPinByDistrictLoading] = useState(false);
  // Inputs specific to each category
  const [assignStates, setAssignStates] = useState([]); // array of state IDs (SC)
  // NOTE: reusing selectedState from location section as state PK for agency selection as well
  const [assignDistricts, setAssignDistricts] = useState([]); // array of districts (DC)
  const [selectedDistrictAgency, setSelectedDistrictAgency] = useState(""); // for D, PC
  const [assignPincodes, setAssignPincodes] = useState([]); // array of pincodes (PC)
  const [selectedPincodeAgency, setSelectedPincodeAgency] = useState(""); // (P, SF)

  // For SC: default Country to India and load states of that country
  useEffect(() => {
    if (!isSC) return;
    (async () => {
      try {
        let countryId = selectedCountry;
        if (!countryId && countries && countries.length) {
          const india = countries.find((c) => /india/i.test(c?.name || ""));
          countryId = india ? String(india.id) : String(countries[0].id);
          setSelectedCountry(countryId);
        }
        if (countryId) {
          const resp = await API.get(`/location/states/`, { params: { country: countryId } });
          const rows = Array.isArray(resp?.data) ? resp.data : resp?.data?.results || [];
          const norm = rows.map((r) => ({ id: r.id, name: r.name }));
          setAllStatesList(norm);
        } else {
          setAllStatesList([]);
        }
      } catch {
        setAllStatesList([]);
      }
    })();
  }, [isSC, selectedCountry, countries]);

  // Fetch sponsor-based states whenever sponsorId and agency category change
  useEffect(() => {
    if (!isAgency) return;
    const s = normalizeSponsor(sponsorId);
    if (!s) {
      setSponsorStates([]);
      return;
    }
    (async () => {
      try {
        const resp = await API.get(`/accounts/regions/by-sponsor/`, {
          params: { sponsor: s, level: "state" },
        });
        const states = resp?.data?.states || [];
        setSponsorStates(states);
      } catch {
        setSponsorStates([]);
      }
    })();
  }, [isAgency, sponsorId, currentCategory]);

  // Fetch sponsor-based districts whenever selectedState is set (for DC/D/PC)
  useEffect(() => {
    if (!(isDC || isDistrictCat || isPC)) {
      setSponsorDistricts([]);
      return;
    }
    const s = normalizeSponsor(sponsorId);
    if (!s || !selectedState) {
      setSponsorDistricts([]);
      return;
    }
    (async () => {
      try {
        const resp = await API.get(`/accounts/regions/by-sponsor/`, {
          params: { sponsor: s, level: "district", state_id: selectedState },
        });
        const districts = resp?.data?.districts || [];
        setSponsorDistricts(districts);
      } catch {
        setSponsorDistricts([]);
      }
    })();
  }, [isDC, isDistrictCat, isPC, sponsorId, selectedState]);

  // Also load fallback cities list for selected state (for DC when sponsor has no districts)
  useEffect(() => {
    if ((isDC || isDistrictCat || isSubFranchiseCat) && selectedState) {
      loadCities(selectedState);
    }
  }, [isDC, isDistrictCat, isSubFranchiseCat, selectedState]);

  // Compute district options: prefer sponsorDistricts, else fallback to cities list
  const districtOptions = useMemo(() => {
    // For Sub-Franchise, drive districts purely from selected State's cities (independent of sponsor)
    if (isSubFranchiseCat) {
      const fromCities = (cities || []).map((c) => c?.name || c?.Name || c?.city || c?.City).filter(Boolean);
      return Array.from(new Set(fromCities));
    }

    const fromSponsor = (sponsorDistricts || [])
      .filter((d) => String(d.state_id) === String(selectedState))
      .map((d) => d.district)
      .filter(Boolean);

    if (fromSponsor.length) {
      return Array.from(new Set(fromSponsor));
    }
    // Fallback to cities list
    const fromCities = (cities || []).map((c) => c?.name || c?.Name || c?.city || c?.City).filter(Boolean);
    return Array.from(new Set(fromCities));
  }, [isSubFranchiseCat, sponsorDistricts, selectedState, cities]);

  // Fetch sponsor-based pincodes for PC, P and SF
  useEffect(() => {
    if (!(isPC || isPincodeCat || isSubFranchiseCat)) {
      setSponsorPincodes([]);
      return;
    }
    const s = normalizeSponsor(sponsorId);
    if (!s) {
      setSponsorPincodes([]);
      return;
    }
    (async () => {
      try {
        const resp = await API.get(`/accounts/regions/by-sponsor/`, {
          params: { sponsor: s, level: "pincode" },
        });
        const pins = resp?.data?.pincodes || [];
        setSponsorPincodes(pins);
      } catch {
        setSponsorPincodes([]);
      }
    })();
  }, [isPC, isPincodeCat, isSubFranchiseCat, sponsorId]);

  // Load pincodes for selected district (optionally filtered by selected state)
  useEffect(() => {
    if (!(isPC || isPincodeCat || isSubFranchiseCat)) {
      setDistrictPincodes([]);
      return;
    }
    if (!selectedDistrictAgency) {
      setDistrictPincodes([]);
      return;
    }
    setPinByDistrictLoading(true);
    (async () => {
      try {
        const resp = await API.get("/location/pincodes/by-district/", {
          params: { district_name: selectedDistrictAgency, state_id: selectedState },
        });
        const pins = resp?.data?.pincodes || [];
        setDistrictPincodes(pins);
        // Keep only valid selections if options changed
        setAssignPincodes((prev) => (Array.isArray(prev) ? prev.filter((p) => pins.includes(p)) : []));
        if (selectedPincodeAgency && !pins.includes(selectedPincodeAgency)) {
          setSelectedPincodeAgency("");
        }
      } catch (err) {
        setDistrictPincodes([]);
      } finally {
        setPinByDistrictLoading(false);
      }
    })();
  }, [isPC, isPincodeCat, isSubFranchiseCat, selectedDistrictAgency, selectedState]);

  // Effective pincode options: prefer district-based; if sponsor constraint exists, intersect
  const pincodeOptions = useMemo(() => {
    // For Sub-Franchise, list all pincodes for the selected district irrespective of sponsor
    if (isSubFranchiseCat) {
      return Array.isArray(districtPincodes) ? districtPincodes : [];
    }
    const hasDistrict = Array.isArray(districtPincodes) && districtPincodes.length > 0;
    const hasSponsor = Array.isArray(sponsorPincodes) && sponsorPincodes.length > 0;
    if (hasDistrict && hasSponsor) {
      const sponsorSet = new Set(sponsorPincodes);
      return districtPincodes.filter((p) => sponsorSet.has(p));
    }
    return hasDistrict ? districtPincodes : sponsorPincodes;
  }, [isSubFranchiseCat, districtPincodes, sponsorPincodes]);

  const validateAgencyInputs = () => {
    if (!sponsorId.trim()) {
      setErrorMsg("Sponsor Username is required for agency registrations.");
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
      // ensure selectedState is among sponsorStates
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
      // ensure selectedDistrict is among sponsorDistricts for selectedState if provided
      if (
        sponsorDistricts.length &&
        !sponsorDistricts.some(
          (d) => String(d.state_id) === String(selectedState) && String(d.district).toLowerCase() === selectedDistrictAgency.trim().toLowerCase()
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
      // optional: ensure selected pins belong to sponsor's list if provided
      if (sponsorPincodes.length && assignPincodes.some((p) => !sponsorPincodes.includes(p))) {
        setErrorMsg("One or more selected pincodes are not under the Sponsor's assignment.");
        return false;
      }
    } else if (isPincodeCat || isSubFranchiseCat) {
      // For Sub-Franchise, ensure State and City are chosen to list city pincodes
      if (isSubFranchiseCat) {
        if (!selectedState) {
          setErrorMsg("Please select a State.");
          return false;
        }
        if (!selectedDistrictAgency.trim()) {
          setErrorMsg("Please select a City.");
          return false;
        }
      }
      if (!selectedPincodeAgency.trim() || !/^\d{6}$/.test(selectedPincodeAgency.trim())) {
        setErrorMsg("Please select a valid 6-digit pincode.");
        return false;
      }
      // For Pincode category, enforce sponsor restriction; for Sub-Franchise, allow any district pincode
      if (isPincodeCat && sponsorPincodes.length && !sponsorPincodes.includes(selectedPincodeAgency.trim())) {
        setErrorMsg("Selected pincode is not under the Sponsor's assignment.");
        return false;
      }
    }
    setErrorMsg("");
    return true;
  };

  const loginField = {
    label: "Username",
    type: "text",
    inputMode: "text",
    placeholder: "Enter username",
  };

  // Pretty-print role for contextual login error message
  const prettyRole = (r) =>
    ({
      user: "Consumer",
      agency: "Agency",
      employee: "Employee",
      business: "Merchant",
    }[String(r || "").toLowerCase()] || String(r || ""));

  // Resolve registered role/category for a username to detect role mismatch before login
  const resolveRegisteredRole = async (uname) => {
    try {
      const r = await API.get("/accounts/hierarchy/", { params: { username: String(uname || "").trim() } });
      const u = r?.data?.user || r?.data || {};
      let ro = (u?.role || "").toLowerCase();
      if (!ro) {
        const c = (u?.category || "").toLowerCase();
        if (c.startsWith("agency")) ro = "agency";
        else if (c === "consumer") ro = "user";
        else if (c === "employee") ro = "employee";
        else if (c === "business") ro = "business";
      }
      return ro || null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        // Accept username or phone; backend resolves and disambiguates if needed
        let username = (formData.username || "").trim();
        const submitRole = role;

        // Preflight: resolve user's registered role and show a targeted mismatch error
        const resolved = await resolveRegisteredRole(username);
        if (resolved && resolved !== submitRole) {
          setErrorMsg(`You are registered as ${prettyRole(resolved)} but trying to login as ${prettyRole(submitRole)}.`);
          return;
        }

        const res = await API.post("/accounts/login/", {
          username,
          password: formData.password,
          role: submitRole,
        });

        const access = res?.data?.access || res?.data?.token || res?.data?.data?.token;
        const refreshTok = res?.data?.refresh;
        if (!access) throw new Error("No access token returned from server");

        const payload = JSON.parse(atob(access.split(".")[1] || ""));
        const tokenRole = payload?.role;
        const tokenUsername = payload?.username;
        const tokenFullName = payload?.full_name;

        if (!tokenRole) throw new Error("Token missing role claim");

        // Determine effective app namespace from token role/category
        const roleEffective =
          payload?.role_effective ||
          (String(payload?.category || "").toLowerCase() === "business" ? "business" : tokenRole);

        const ns = (payload?.is_staff || payload?.is_superuser) ? "admin" : (roleEffective || tokenRole || "user");
        const store = remember ? localStorage : sessionStorage;

        // Clean legacy non-namespaced keys to avoid cross-role collisions
        try {
          localStorage.removeItem("token");
          localStorage.removeItem("refresh");
          localStorage.removeItem("role");
          localStorage.removeItem("user");
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("refresh");
          sessionStorage.removeItem("role");
          sessionStorage.removeItem("user");
        } catch (_) {}

        store.setItem(`token_${ns}`, access);
        if (refreshTok) store.setItem(`refresh_${ns}`, refreshTok);
        store.setItem(`role_${ns}`, roleEffective || tokenRole || "user");

        try {
          // Use the freshly issued access token explicitly here to avoid namespace mixups
          // while we are still on the /login route (which would default to "user" namespace).
          const authHeaders = { headers: { Authorization: `Bearer ${access}` } };
          const meResp = await API.get("/accounts/me/", authHeaders);
          if (meResp?.data) {
            store.setItem(`user_${ns}`, JSON.stringify(meResp.data));
          } else {
            store.setItem(
              `user_${ns}`,
              JSON.stringify({ role: tokenRole, username: tokenUsername, full_name: tokenFullName })
            );
          }
        } catch (_) {
          store.setItem(
            `user_${ns}`,
            JSON.stringify({ role: tokenRole, username: tokenUsername, full_name: tokenFullName })
          );
        }

        if (remember) {
          localStorage.setItem("remember_username", username);
        } else {
          localStorage.removeItem("remember_username");
        }

        if (payload?.is_staff || payload?.is_superuser) {
          navigate("/admin/dashboard", { replace: true });
        } else {
          navigate(`/${roleEffective || tokenRole || "user"}/dashboard`, { replace: true });
        }
    } catch (err) {
      console.error(err);
      const data = err?.response?.data;
      if (data?.multiple_accounts && Array.isArray(data.multiple_accounts)) {
        const choices = data.multiple_accounts.map((a) => a.username).join(", ");
        setErrorMsg(`Multiple accounts ambiguity. Please enter one of these usernames: ${choices}`);
      } else {
        const msg =
          data?.detail || (data ? JSON.stringify(data) : "Login failed!");
        setErrorMsg(typeof msg === "string" ? msg : String(msg));
      }
    }
  };

  // registration fields renderer (kept, with adornments)
  const renderRegistrationFields = () => {
    switch (role) {
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
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Country</InputLabel>
              <Select
                label="Country"
                value={selectedCountry}
                onChange={handleCountryChange}
                required
              >
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
                  setSelectedCity(e.target.value);
                  setPincode("");
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

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Pincode</InputLabel>
              <Select
                label="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                required
                disabled={!selectedCity || pinByDistrictLoadingNA}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {(nonAgencyDistrictPincodes || []).map((pin) => (
                  <MenuItem key={pin} value={pin}>
                    {pin}
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
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Registration Type</InputLabel>
              <Select
                value={agencyLevel}
                label="Registration Type"
                onChange={(e) => {
                  setAgencyLevel(e.target.value);
                  // reset region inputs on type change
                  setAssignStates([]);
                  setAssignDistricts([]);
                  setSelectedDistrictAgency("");
                  setAssignPincodes([]);
                  setSelectedPincodeAgency("");
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

            <TextField
              fullWidth
              label="Sponsor Username"
              value={sponsorId}
              onChange={(e) => setSponsorId(e.target.value)}
              required
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <HomeIcon />
                  </InputAdornment>
                ),
              }}
            />

            {!sponsorId.trim() && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Enter Sponsor Username to continue selecting regions.
              </Alert>
            )}

            {/* Agency-specific region UI */}
            {(sponsorId && isSC) && (
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
                      const s = allStatesList.find((x) => String(x.id) === String(id));
                      return s ? s.name : id;
                    });
                    return names.join(", ");
                  }}
                >
                  {(allStatesList || []).map((s) => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">Select up to 2 states.</Typography>
              </FormControl>
            )}

            {isSubFranchiseCat && (
              <>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Country</InputLabel>
                  <Select
                    label="Country"
                    value={selectedCountry}
                    onChange={handleCountryChange}
                  >
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
                    onChange={(e) => {
                      setSelectedState(e.target.value);
                      setAssignDistricts([]);
                      setSelectedDistrictAgency("");
                      setSelectedPincodeAgency("");
                    }}
                    disabled={!selectedCountry}
                  >
                    <MenuItem value="">-- Select --</MenuItem>
                    {(states || []).map((s) => (
                      <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}

            {(sponsorId && (isStateCat || isDC || isDistrictCat || isPC)) && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>State (under Sponsor)</InputLabel>
                <Select
                  label="State (under Sponsor)"
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setAssignDistricts([]);
                    setSelectedDistrictAgency("");
                  }}
                >
                  <MenuItem value="">-- Select --</MenuItem>
                  {(sponsorStates || []).map((s) => (
                    <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {(sponsorId && isDC) && (
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
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">Select up to 2 districts.</Typography>
              </FormControl>
            )}

            {isSubFranchiseCat && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>City</InputLabel>
                <Select
                  label="City"
                  value={selectedDistrictAgency}
                  onChange={(e) => {
                    setSelectedDistrictAgency(e.target.value);
                    setSelectedPincodeAgency("");
                  }}
                  disabled={!selectedState}
                >
                  <MenuItem value="">-- Select --</MenuItem>
                  {(districtOptions || []).map((d) => (
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {(sponsorId && (isDistrictCat || isPC)) && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>District (under Sponsor)</InputLabel>
                <Select
                  label="District (under Sponsor)"
                  value={selectedDistrictAgency}
                  onChange={(e) => setSelectedDistrictAgency(e.target.value)}
                  disabled={!selectedState}
                >
                  <MenuItem value="">-- Select --</MenuItem>
                  {(sponsorDistricts || [])
                    .filter((d) => String(d.state_id) === String(selectedState))
                    .map((d) => (
                      <MenuItem key={`${d.state_id}_${d.district}`} value={d.district}>
                        {d.district}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}

            {(sponsorId && isPC) && (
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
                    <MenuItem key={pin} value={pin}>{pin}</MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">Select up to 4 pincodes.</Typography>
              </FormControl>
            )}

            {((sponsorId && isPincodeCat) || isSubFranchiseCat) && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>{isSubFranchiseCat ? "Pincode" : "Pincode (under Sponsor)"}</InputLabel>
                <Select
                  label={isSubFranchiseCat ? "Pincode" : "Pincode (under Sponsor)"}
                  value={selectedPincodeAgency}
                  onChange={(e) => setSelectedPincodeAgency(e.target.value)}
                  disabled={isSubFranchiseCat ? (!selectedState || !selectedDistrictAgency) : false}
                >
                  <MenuItem value="">-- Select --</MenuItem>
                  {(pincodeOptions || []).map((pin) => (
                    <MenuItem key={pin} value={pin}>{pin}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </>
        );
      case "user":
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
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Country</InputLabel>
              <Select
                label="Country"
                value={selectedCountry}
                onChange={handleCountryChange}
                required
              >
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
                  setSelectedCity(e.target.value);
                  setPincode("");
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

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Pincode</InputLabel>
              <Select
                label="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                required
                disabled={!selectedCity || pinByDistrictLoadingNA}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {(nonAgencyDistrictPincodes || []).map((pin) => (
                  <MenuItem key={pin} value={pin}>
                    {pin}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        );
      case "business":
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
              label="Merchant Name"
              name="business_name"
              value={formData.business_name}
              onChange={handleChange}
              sx={{ mb: 2 }}
              required
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={formData.business_category}
                onChange={(e) => setFormData({ ...formData, business_category: e.target.value })}
                required
              >
                <MenuItem value="Food/Education">Food/Education</MenuItem>
                <MenuItem value="Accounting">Accounting</MenuItem>
                <MenuItem value="Beauty & Store">Beauty & Store</MenuItem>
                <MenuItem value="Retail">Retail</MenuItem>
                <MenuItem value="Health">Health</MenuItem>
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
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Country</InputLabel>
              <Select
                label="Country"
                value={selectedCountry}
                onChange={handleCountryChange}
                required
              >
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
                  setSelectedCity(e.target.value);
                  setPincode("");
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

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Pincode</InputLabel>
              <Select
                label="Pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                required
                disabled={!selectedCity || pinByDistrictLoadingNA}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {(nonAgencyDistrictPincodes || []).map((pin) => (
                  <MenuItem key={pin} value={pin}>
                    {pin}
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

  // === FINAL UI (polished) ===
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: { xs: "linear-gradient(180deg,#fafcff 0%,#ffffff 100%)", md: "linear-gradient(135deg,#eaf6ff 0%,#ffffff 70%)" },
        overflowX: "hidden",
        maxWidth: "100%",
        "&, *": { boxSizing: "border-box" },
        "& img": { maxWidth: "100%", display: "block" },
      }}
    >
      {/* Nav */}
      <AppBar position="sticky" color="default" elevation={0} sx={{ backgroundColor: "#ffffff", color: "#0f172a", borderBottom: "1px solid #e2e8f0" }}>
        <Toolbar sx={{ gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }} onClick={() => navigate("/")}>
            <img src={LOGO} alt="Trikonekt" style={{ height: 38 }} />
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Button
            color="inherit"
            sx={{ textTransform: "none", fontWeight: 600, mr: 1 }}
            onClick={() => setDrawerOpen(true)}
          >
            {prettyRole(role)}
          </Button>
          <IconButton color="inherit" onClick={() => setDrawerOpen(true)} aria-label="open menu">
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main container */}
      <Container maxWidth="sm" sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", py: { xs: 4, md: 10 } }}>
        <Paper
          elevation={3}
          sx={{
            width: "100%",
            maxWidth: 400,
            mx: "auto",
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            backgroundColor: "#fff",
            boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
            textAlign: "center",
            transition: "all 0.25s ease",
            "&:hover": { boxShadow: "0 10px 24px rgba(0,0,0,0.08)" },
          }}
        >
          <Box sx={{ textAlign: "center", mb: 1 }}>
            <Avatar src={LOGO} alt="Trikonekt" sx={{ width: 64, height: 64, mx: "auto", mb: 1, bgcolor: "transparent" }} />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Tabs
            value={mode}
            onChange={(_, nv) => setMode(nv)}
            variant="fullWidth"
            TabIndicatorProps={{ sx: { backgroundColor: "#1976d2", height: 2 } }}
            sx={{ display: "none" }}
          >
            <Tab label="Login" value="login" />
            <Tab label="Register" value="register" />
          </Tabs>

          <Box sx={{ mb: 2, display: "none" }}>
            <ToggleButtonGroup
              value={role}
              exclusive
              onChange={handleRoleChange}
              fullWidth
              sx={{
                mb: 1.5,
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
                "& .MuiToggleButton-root": {
                  flex: { xs: "1 1 100%", sm: "1 1 calc(50% - 8px)" },
                  textTransform: "none",
                  fontWeight: 500,
                  py: { xs: 1, sm: 0.75 },
                  borderRadius: 2,
                  borderColor: "#e0e0e0",
                  justifyContent: "flex-start",
                },
                "& .MuiToggleButton-root.Mui-selected": {
                  borderColor: "#2e7d32",
                  backgroundColor: "rgba(46,125,50,0.08)",
                  color: "#2e7d32",
                },
                "& .MuiToggleButton-root.Mui-selected:hover": {
                  backgroundColor: "rgba(46,125,50,0.12)",
                },
              }}
            >
              <ToggleButton value="user" aria-label="consumer" disabled={Boolean(lockedRole && lockedRole !== "user")}>
                <Box sx={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <PersonIcon sx={{ mr: 1 }} /> Consumer
                  </Box>
                  {role === "user" && <CheckCircleIcon color="success" fontSize="small" />}
                </Box>
              </ToggleButton>
              <ToggleButton value="agency" aria-label="agency" disabled={Boolean(lockedRole && lockedRole !== "agency")}>
                <Box sx={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <StoreIcon sx={{ mr: 1 }} /> Agency
                  </Box>
                  {role === "agency" && <CheckCircleIcon color="success" fontSize="small" />}
                </Box>
              </ToggleButton>
              <ToggleButton value="employee" aria-label="employee" disabled={Boolean(lockedRole && lockedRole !== "employee")}>
                <Box sx={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <WorkIcon sx={{ mr: 1 }} /> Employee
                  </Box>
                  {role === "employee" && <CheckCircleIcon color="success" fontSize="small" />}
                </Box>
              </ToggleButton>
              <ToggleButton value="business" aria-label="merchant" disabled={Boolean(lockedRole && lockedRole !== "business")}>
                <Box sx={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <BusinessIcon sx={{ mr: 1 }} /> Merchant
                  </Box>
                  {role === "business" && <CheckCircleIcon color="success" fontSize="small" />}
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {errorMsg && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg("")}>{errorMsg}</Alert>}
          {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg("")}>{successMsg}</Alert>}

          <Box component="form" noValidate onSubmit={handleSubmit} className="auth-mobile-full">
            {!isLogin && (
              <Box>
                {renderRegistrationFields()}

                {!isAgency && (
                  <Box sx={{ textAlign: "left" }}>
                    <TextField
                      fullWidth
                      label="Sponsor Username"
                      value={sponsorId}
                      onChange={(e) => setSponsorId(e.target.value)}
                      required
                      sx={{ mb: 1 }}
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
                        <Typography variant="body2" color="text.secondary">Validating sponsor…</Typography>
                      </Box>
                    )}
                    {sponsorValid === true && (
                      <Alert severity="success" sx={{ mb: 1 }}>
                        Verified Sponsor: {sponsorDisplay.name || sponsorDisplay.username}
                        {sponsorDisplay.pincode ? ` (Pincode: ${sponsorDisplay.pincode})` : ""}
                      </Alert>
                    )}
                    {sponsorValid === false && (
                      <Alert severity="error" sx={{ mb: 1 }}>
                        Invalid Sponsor ID. Please correct the Sponsor ID.
                      </Alert>
                    )}
                  </Box>
                )}



              </Box>
            )}

            {isLogin && (
              <TextField
                fullWidth
                name="username"
                value={formData.username}
                label={loginField.label}
                placeholder={loginField.placeholder}
                type={loginField.type}
                inputProps={{ inputMode: loginField.inputMode }}
                onChange={handleChange}
                sx={{ mb: 2 }}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AccountCircle />
                    </InputAdornment>
                  ),
                }}
              />
            )}

            <TextField
              fullWidth
              name="password"
              value={formData.password}
              label="Password"
              type={showPassword ? "text" : "password"}
              onChange={handleChange}
              sx={{ mb: isLogin ? 2.5 : 3 }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock />
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

            {!isLogin && (
              <TextField
                fullWidth
                label="Confirm Password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                sx={{ mb: 2 }}
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
            )}

            {isLogin && (
              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, justifyContent: { xs: "flex-start", sm: "space-between" }, width: "100%", mb: 2, gap: 1 }}>
                <FormControlLabel
                  sx={{
                    alignItems: "center",
                    "& .MuiCheckbox-root": { mt: "-3px" },
                    "& .MuiTypography-root": { fontSize: 14, ml: 0.5, mt: "1px" },
                  }}
                  control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} size="small" />}
                  label="Remember me"
                />
                <Box sx={{ ml: { sm: 0 }, textAlign: { xs: "left", sm: "right" }, display: { xs: "none", sm: "block" } }}>
                  <Button type="button" size="small" sx={{ textTransform: "none" }} onClick={() => setForgotOpen(true)}>
                    Forgot password?
                  </Button>
                </Box>
              </Box>
            )}

            <Button
              fullWidth
              type="submit"
              onClick={(e) => handleSubmit(e)}
              variant="contained"
              sx={{
                py: 1.05,
                fontWeight: 700,
                borderRadius: 1.25,
                background: "linear-gradient(90deg,#1976d2 0%,#42a5f5 100%)",
                boxShadow: "0 6px 18px rgba(25,118,210,0.16)",
                "&:active": { transform: "translateY(1px)" },
                mb: 1.25,
              }}
            >
              {isLogin ? "LOGIN" : "REGISTER"}
            </Button>

            {isLogin && (
              <Box sx={{ display: { xs: "block", sm: "none" }, textAlign: "left", mt: 0.5, mb: 1 }}>
                <Button type="button" size="small" sx={{ textTransform: "none" }} onClick={() => setForgotOpen(true)}>
                  Forgot password?
                </Button>
              </Box>
            )}

            <Box sx={{ mt: 1.5, textAlign: { xs: "left", sm: "center" } }}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Don't have an account?{" "}
                <Link component="button" type="button" variant="body2" onClick={handleRegisterNav} sx={{ fontWeight: 700 }}>
                  Register here
                </Link>
              </Typography>
            </Box>

          </Box>

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
            </DialogActions>
          </Dialog>

          <Dialog open={forgotOpen} onClose={() => setForgotOpen(false)} fullWidth maxWidth="xs">
            <DialogTitle>Reset Password</DialogTitle>
            <DialogContent>
              <TextField margin="dense" label="Username" fullWidth value={fpUsername} onChange={(e) => setFpUsername(e.target.value)} />
              <TextField margin="dense" label="New Password" type="password" fullWidth value={fpNewPassword} onChange={(e) => setFpNewPassword(e.target.value)} />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setForgotOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={handlePasswordReset} disabled={fpLoading}>
                {fpLoading ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Container>

      {/* Category Drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 280 }} role="presentation" onKeyDown={(e) => e.key === "Escape" && setDrawerOpen(false)}>
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="h6">Select Category</Typography>
            <Typography variant="body2" color="text.secondary">Choose the category to login.</Typography>
          </Box>
          <Divider />
          <List>
            <ListItemButton selected={role === "user"} onClick={() => { setRole("user"); setDrawerOpen(false); }}>
              <ListItemIcon><PersonIcon /></ListItemIcon>
              <ListItemText primary="Consumer" />
            </ListItemButton>
            <ListItemButton selected={role === "agency"} onClick={() => { setRole("agency"); setDrawerOpen(false); }}>
              <ListItemIcon><StoreIcon /></ListItemIcon>
              <ListItemText primary="Agency" />
            </ListItemButton>
            <ListItemButton selected={role === "employee"} onClick={() => { setRole("employee"); setDrawerOpen(false); }}>
              <ListItemIcon><WorkIcon /></ListItemIcon>
              <ListItemText primary="Employee" />
            </ListItemButton>
            <ListItemButton selected={role === "business"} onClick={() => { setRole("business"); setDrawerOpen(false); }}>
              <ListItemIcon><BusinessIcon /></ListItemIcon>
              <ListItemText primary="Merchant" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      <Box sx={{ py: { xs: 2.5, md: 3 }, textAlign: "center", backgroundColor: "rgba(255,255,255,0.85) !important",
          color: "#000",
          boxShadow: "0 0px 15px rgba(0,0,0,0.08) !important", }}>
        <Typography variant="body2">
                    © {new Date().getFullYear()} Trikonekt. All rights reserved.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Contact us:{" "}
                    <Link
                      href="mailto:contact@trikonekt.com"
                      underline="hover"
                      color="inherit"
                      sx={{ fontWeight: 500 }}
                    >
                      contact@trikonekt.com
                    </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Login;
