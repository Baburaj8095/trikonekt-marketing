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
  CheckCircleRounded as CheckIcon,
} from "@mui/icons-material";

import "@fontsource/poppins";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import API from "../../api/api";
import LOGO from "../../assets/TRIKONEKT.png";
import "./EnhancedLogin.css";


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
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.body.style.fontFamily = "'Poppins', sans-serif";
  }, []);

  // If a role is locked via route param, force-select it and default to register view for register links
  useEffect(() => {
    if (lockedRole && role !== lockedRole) {
      setRole(lockedRole);
    }
    if (lockedRole && mode !== "register") {
      setMode("register");
    }
  }, [lockedRole]);

  // Auth redirect behavior:
  // - Do NOT redirect on any Register route or when query param mode=register.
  // - In Login mode with a locked role, redirect ONLY if a session exists for that role.
  // - In Login mode without a locked role, redirect to the first available session.
  useEffect(() => {
    try {
      const path = (location && location.pathname) || "";
      const qMode = new URLSearchParams((location && location.search) || "").get("mode");
      if (path.includes("/register") || mode === "register" || String(qMode).toLowerCase() === "register") return;

      const mapLockedToNs = (r) => {
        const rl = String(r || "").toLowerCase();
        return ["admin", "user", "agency", "employee", "business"].includes(rl) ? rl : null;
      };

      const preferredNs = mapLockedToNs(lockedRole);
      if (preferredNs) {
        const has =
          localStorage.getItem(`token_${preferredNs}`) ||
          sessionStorage.getItem(`token_${preferredNs}`);
        if (has) {
          const to = preferredNs === "admin" ? "/admin/dashboard" : `/${preferredNs}/dashboard`;
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
  }, [location.pathname, location.search, mode, lockedRole, navigate]);

  const handleModeChange = () => setMode(mode === "login" ? "register" : "login");
  const handleRoleChange = (_, val) => {
    if (lockedRole) return;
    if (val) setRole(val);
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
  const [stateVal, setStateVal] = useState("");
  const [countryVal, setCountryVal] = useState("");
  const [cityOptions, setCityOptions] = useState([]);

  // Geo fields
  const [geoCountryName, setGeoCountryName] = useState("");
  const [geoCountryCode, setGeoCountryCode] = useState("");
  const [geoStateName, setGeoStateName] = useState("");
  const [geoCityName, setGeoCityName] = useState("");
  const geoRequestedRef = useRef(false);
  const skipPinLookupRef = useRef(false);

  const [sponsorId, setSponsorId] = useState("");
  const [agencyLevel, setAgencyLevel] = useState("");
  const [sponsorLocked, setSponsorLocked] = useState(false);
  const [sponsorChecking, setSponsorChecking] = useState(false);
  const [sponsorValid, setSponsorValid] = useState(null); // null unknown, true valid, false invalid
  const [sponsorDisplay, setSponsorDisplay] = useState({ name: "", pincode: "", username: "" });

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
  const [remember, setRemember] = useState(false);
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
    // Only auto-lookup pincode during Register for non-agency/non-business flows
    if (mode !== "register" || role === "agency" || role === "business") return;

    // Skip one immediate lookup when pincode was set from reverse geocode
    if (skipPinLookupRef.current) {
      skipPinLookupRef.current = false;
      return;
    }

    const code = (pincode || "").trim();
    if (code.replace(/\D/g, "").length === 6) {
      const t = setTimeout(() => fetchFromBackendPin(code), 400);
      return () => clearTimeout(t);
    }
  }, [pincode, mode, role]);

  // Parse role and category from URL for prefilled registration links
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const rp = (params.get("role") || "").toLowerCase();
      const level = (params.get("agency_level") || params.get("category") || "").toLowerCase();
      if (rp === "user" || rp === "employee" || rp === "agency" || rp === "business") {
        setMode("register");
        setRole(rp);
        if (rp === "agency" && level) setAgencyLevel(level);
      }
    } catch (_) {}
  }, []);
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
      if (norm) {
        setSponsorId(norm);
        setSponsorLocked(true);
      }
    } catch {}
  }, []);

  // Auto-select Sub Franchise when registering agency via sponsor link
  useEffect(() => {
    if (mode === "register" && role === "agency" && sponsorLocked && !agencyLevel) {
      setAgencyLevel("sub_franchise");
    }
  }, [mode, role, sponsorLocked, agencyLevel]);

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
      let uname = "";
      try {
        // Prefer public endpoint that now returns sponsor identity
        const r = await API.get("/accounts/regions/by-sponsor/", { params: { sponsor: s, level: "state" } });
        const sp = r?.data?.sponsor || {};
        name = sp.full_name || sp.username || "";
        pcode = sp.pincode || "";
        uname = sp.username || "";
        exists = Boolean(name || pcode || uname);
      } catch (_) {
        exists = false;
      } finally {
        setSponsorValid(exists);
        setSponsorDisplay({ name, pincode: pcode, username: uname || s });
        setSponsorChecking(false);
      }
    }, 450);
    return () => {
      setSponsorChecking(false);
      clearTimeout(t);
    };
  }, [mode, sponsorId]);

  // Auto detect location
  useEffect(() => {
    // Only run geolocation during Register and when not Agency
    if (mode !== "register" || role === "agency") {
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

          skipPinLookupRef.current = true;
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
    if (pin.length !== 6) {
      alert("Enter a valid 6-digit pincode");
      return;
    }
    setBranchLoading(true);
    setSelectedBranch(null);
    setManualMode(true);
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

      if (list.length === 1) {
        const b = list[0];
        setSelectedBranch(b);
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

  const isLogin = mode === "login";

  // helpers unchanged
  const onlyDigits = (s) => (s || "").replace(/\D/g, "");
  const normalizePins = (arr) =>
    Array.from(
      new Set(
        (arr || [])
          .map((p) => onlyDigits(String(p)).slice(0, 6))
          .filter((p) => /^\d{6}$/.test(p))
      )
    );
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

  // Region inputs and options for agency flow
  const [allStatesList, setAllStatesList] = useState([]); // [{id,name}] for SC
  const [sponsorStates, setSponsorStates] = useState([]); // [{id,name}]
  const [sponsorDistricts, setSponsorDistricts] = useState([]); // [{state_id, state, district}]
  const [sponsorPincodes, setSponsorPincodes] = useState([]); // ["585103", ...]
  const [districtPincodes, setDistrictPincodes] = useState([]);
  const [pinByDistrictLoading, setPinByDistrictLoading] = useState(false);
  // Non-agency (Consumer/Employee/Merchant) district->pincode options
  const [nonAgencyDistrictPincodes, setNonAgencyDistrictPincodes] = useState([]);
  const [pinByDistrictLoadingNA, setPinByDistrictLoadingNA] = useState(false);
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

  // Also load fallback cities list for selected state (for DC/District/Sub-Franchise)
  useEffect(() => {
    if ((isDC || isDistrictCat || isSubFranchiseCat) && selectedState) {
      loadCities(selectedState);
    }
  }, [isDC, isDistrictCat, isSubFranchiseCat, selectedState]);

  // Compute district options: for Sub-Franchise prefer cities list; otherwise prefer sponsorDistricts, else fallback to cities list
  const districtOptions = useMemo(() => {
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
    const fromCities = (cities || []).map((c) => c?.name || c?.Name || c?.city || c?.City).filter(Boolean);
    return Array.from(new Set(fromCities));
  }, [isSubFranchiseCat, sponsorDistricts, selectedState, cities]);

  // Default Country to India for Sub-Franchise and load states
  useEffect(() => {
    if (!isSubFranchiseCat) return;
    if (selectedCountry) return;
    if (!Array.isArray(countries) || !countries.length) return;
    const india = countries.find((c) => /india/i.test(String(c?.name || "")));
    const id = india ? String(india.id) : String(countries[0].id);
    if (id) {
      setSelectedCountry(id);
      loadStates(id);
    }
  }, [isSubFranchiseCat, selectedCountry, countries]);

  // Auto-map geo detected Country -> Country select (non-agency)
  useEffect(() => {
    if (isAgency || mode !== "register") return;
    if (selectedCountry) return;
    const name = String(geoCountryName || "").toLowerCase();
    if (!name || !Array.isArray(countries) || !countries.length) return;
    const match = countries.find((c) => String(c?.name || "").toLowerCase() === name);
    if (match) {
      const id = String(match.id);
      setSelectedCountry(id);
      loadStates(id);
    }
  }, [isAgency, mode, geoCountryName, countries, selectedCountry]);

  // Auto-map geo detected State -> State select (non-agency)
  useEffect(() => {
    if (isAgency || mode !== "register") return;
    if (!selectedCountry || selectedState) return;
    const name = String(geoStateName || "").toLowerCase();
    if (!name || !Array.isArray(states) || !states.length) return;
    const match = states.find((s) => String(s?.name || "").toLowerCase() === name);
    if (match) {
      const id = String(match.id);
      setSelectedState(id);
      loadCities(id);
    }
  }, [isAgency, mode, selectedCountry, geoStateName, states, selectedState]);

  // Auto-map geo detected District/City -> District select (non-agency)
  useEffect(() => {
    if (isAgency || mode !== "register") return;
    if (!selectedState || selectedCity) return;
    const name = String(geoCityName || "").toLowerCase();
    if (!name || !Array.isArray(cities) || !cities.length) return;
    const match = cities.find((c) => {
      const nm = String(c?.name || c?.Name || c?.city || c?.City || "").toLowerCase();
      return nm === name;
    });
    const nm = match?.name || match?.Name || match?.city || match?.City;
    if (nm) setSelectedCity(nm);
  }, [isAgency, mode, selectedState, geoCityName, cities, selectedCity]);

  // Auto-select Pincode for non-agency once district pincodes are loaded
  useEffect(() => {
    if (isAgency || mode !== "register") return;
    if (!selectedState || !selectedCity) return;
    if (!Array.isArray(nonAgencyDistrictPincodes) || nonAgencyDistrictPincodes.length === 0) return;
    const pin = String(pincode || "").replace(/\D/g, "");
    if (/^\d{6}$/.test(pin) && nonAgencyDistrictPincodes.includes(pin)) {
      // already a valid autoselected pin
      return;
    }
    // fallback to the first available pin for the detected district
    setPincode(nonAgencyDistrictPincodes[0]);
  }, [isAgency, mode, selectedState, selectedCity, nonAgencyDistrictPincodes, pincode]);

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
        setSponsorPincodes(normalizePins(pins));
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
        const pinsRaw = resp?.data?.pincodes || [];
        const pins = normalizePins(pinsRaw);
        setDistrictPincodes(pins);
        // Keep only valid selections if options changed
        setAssignPincodes((prev) =>
          Array.isArray(prev)
            ? prev
                .map((p) => onlyDigits(String(p)).slice(0, 6))
                .filter((p) => pins.includes(p))
            : []
        );
        if (selectedPincodeAgency) {
          const sel = onlyDigits(String(selectedPincodeAgency)).slice(0, 6);
          if (!pins.includes(sel)) {
            setSelectedPincodeAgency("");
          }
        }
      } catch (err) {
        setDistrictPincodes([]);
      } finally {
        setPinByDistrictLoading(false);
      }
    })();
  }, [isPC, isPincodeCat, isSubFranchiseCat, selectedDistrictAgency, selectedState]);

  // Effective pincode options: prefer district-based; if sponsor constraint exists, intersect
  // Non-agency: load pincode options when State and District (City) are selected
  useEffect(() => {
    if (isAgency) {
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
        const pinsRaw = resp?.data?.pincodes || [];
        const pins = normalizePins(pinsRaw);
        setNonAgencyDistrictPincodes(pins);
        // Clear pincode if it is no longer valid for the selected district
        setPincode((prev) => (pins.includes(onlyDigits(String(prev)).slice(0, 6)) ? onlyDigits(String(prev)).slice(0, 6) : ""));
      } catch {
        setNonAgencyDistrictPincodes([]);
      } finally {
        setPinByDistrictLoadingNA(false);
      }
    })();
  }, [isAgency, selectedCity, selectedState]);

  const pincodeOptions = useMemo(() => {
    // Sub‑Franchise should list all pincodes for the selected district irrespective of sponsor coverage
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
    } else if (isSubFranchiseCat) {
      if (!selectedState) {
        setErrorMsg("Please select a State.");
        return false;
      }
      if (!selectedDistrictAgency.trim()) {
        setErrorMsg("Please select a District.");
        return false;
      }
      if (!selectedPincodeAgency.trim() || !/^\d{6}$/.test(selectedPincodeAgency.trim())) {
        setErrorMsg("Please select a valid 6-digit pincode.");
        return false;
      }
    } else if (isPincodeCat) {
      if (!selectedState) {
        setErrorMsg("Please select a State.");
        return false;
      }
      if (!selectedDistrictAgency.trim()) {
        setErrorMsg("Please select a District.");
        return false;
      }
      if (!selectedPincodeAgency.trim() || !/^\d{6}$/.test(selectedPincodeAgency.trim())) {
        setErrorMsg("Please select a valid 6-digit pincode.");
        return false;
      }
      if (sponsorPincodes.length && !sponsorPincodes.includes(selectedPincodeAgency.trim())) {
        setErrorMsg("Selected pincode is not under the Sponsor's assignment.");
        return false;
      }
    }
    setErrorMsg("");
    return true;
  };

  const loginField = {
    label: "Username or Phone",
    type: "text",
    inputMode: "text",
    placeholder: "Enter username (e.g., TREP9876543210) or phone (10 digits)",
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (mode === "login") {
      try {
        // Accept username or phone; backend resolves and disambiguates if needed
        let username = (formData.username || "").trim();
        const submitRole = role;

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


        // Namespaced session per role; staff -> admin namespace
        const ns = (payload?.is_staff || payload?.is_superuser) ? "admin" : (tokenRole || "user");
        localStorage.setItem(`token_${ns}`, access);
        if (refreshTok) localStorage.setItem(`refresh_${ns}`, refreshTok);
        if (tokenRole) localStorage.setItem(`role_${ns}`, tokenRole);
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

        try {
          const authHeaders = { headers: { Authorization: `Bearer ${access}` } };
          const meResp = await API.get("/accounts/me/", authHeaders);
          if (meResp?.data) {
            localStorage.setItem(`user_${ns}`, JSON.stringify(meResp.data));
          } else {
            localStorage.setItem(`user_${ns}`, JSON.stringify({ role: tokenRole, username: tokenUsername, full_name: tokenFullName }));
          }
        } catch (_) {
          localStorage.setItem(`user_${ns}`, JSON.stringify({ role: tokenRole, username: tokenUsername, full_name: tokenFullName }));
        }

        if (remember) {
          localStorage.setItem("remember_username", username);
        } else {
          localStorage.removeItem("remember_username");
        }

        if (payload?.is_staff || payload?.is_superuser) {
          navigate("/admin/dashboard", { replace: true });
        } else {
          navigate(`/${tokenRole || "user"}/dashboard`, { replace: true });
        }
      } catch (err) {
        console.error(err);
        const data = err?.response?.data;
        if (data?.multiple_accounts && Array.isArray(data.multiple_accounts)) {
          const choices = data.multiple_accounts.map((a) => a.username).join(", ");
          setErrorMsg(`Multiple accounts found for this phone. Please enter one of these usernames: ${choices}`);
        } else {
          const msg =
            data?.detail || (data ? JSON.stringify(data) : "Login failed!");
          setErrorMsg(typeof msg === "string" ? msg : String(msg));
        }
      }
      return;
    }

    // Registration path
    setErrorMsg("");
    setSuccessMsg("");

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

    // Sponsor ID mandatory (from URL param or manual entry)
    if (!sponsorId) {
      setErrorMsg("Sponsor Username is required");
      return;
    }
    if (sponsorValid === false) {
      setErrorMsg("Invalid Sponsor Username. Please correct the Sponsor ID.");
      return;
    }

    // Additional agency-level validations
    if (AGENCY_CATEGORIES.has(category) && !validateAgencyInputs()) {
      return;
    }

    // Location selection mandatory for non-agency registrations
    if (!AGENCY_CATEGORIES.has(category)) {
      if (!selectedCountry || !selectedState || !selectedCity || !pincode) {
        setErrorMsg("Please select Country, State, District and Pincode");
        return;
      }
    }

    // Base payload
    const payload = {
      password: formData.password,
      email: formData.email || "",
      full_name: formData.full_name || "",
      phone: formData.phone || "",
      sponsor_id: normalizeSponsor(sponsorId) || "",
      category,
    };

    // Non-agency: include location data
    if (!AGENCY_CATEGORIES.has(category)) {
      Object.assign(payload, {
        country: selectedCountry || null,
        state: selectedState || null,
        city: selectedCity || null,
        pincode,
        country_name: geoCountryName || "",
        country_code: geoCountryCode || "",
        state_name: geoStateName || "",
        city_name: geoCityName || "",
      });
    }

    // Attach agency-specific fields
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

    // Also persist base location on the user for agency categories so Admin table shows Country/State/District/Pincode
    if (AGENCY_CATEGORIES.has(category)) {
      const patch = {};
      if (selectedCountry) patch.country = selectedCountry;
      if (selectedState) patch.state = Number(selectedState);
      if (selectedDistrictAgency) patch.city = String(selectedDistrictAgency).trim();

      // pincode: prefer selected single pincode; else first of assign list (for coordinators)
      if (selectedPincodeAgency) {
        patch.pincode = String(selectedPincodeAgency).trim();
      } else if (Array.isArray(assignPincodes) && assignPincodes.length) {
        patch.pincode = String(assignPincodes[0]).trim();
      }

      // Friendly names for admin display if backend maps these into user fields
      const findName = (arr, id) => {
        try {
          const m = (arr || []).find((x) => String(x?.id) === String(id));
          return m?.name || "";
        } catch {
          return "";
        }
      };
      const cName = findName(countries, selectedCountry);
      const sName = findName(states, selectedState);
      if (cName) patch.country_name = cName;
      if (sName) patch.state_name = sName;
      if (selectedDistrictAgency) patch.city_name = String(selectedDistrictAgency).trim();

      Object.assign(payload, patch);
    }

    try {
      if (category === "business") {
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
          city: selectedCity || null,
          pincode,
          country_name: geoCountryName || "",
          country_code: geoCountryCode || "",
          state_name: geoStateName || "",
          city_name: geoCityName || "",
        };
        await API.post("/business/register/", brPayload);
        setSuccessMsg("Business registration submitted successfully. Admin will review and forward it to the concerned agency. Business login is disabled.");
        setFormData({
          username: "",
          password: "",
          email: "",
          full_name: "",
          phone: "",
          business_name: "",
          business_category: "",
          address: "",
        });
      } else {
        const submittedPassword = formData.password;
        const resp = await API.post("/accounts/register/", payload);
        const data = resp?.data || {};
        const uname = data.username || "(generated)";
        // Success alert + popup with username and password as requested
        setSuccessMsg(`Welcome to Trikonekt!\nUsername: ${uname}\nPassword: ${submittedPassword}`);
        setRegSuccessText({ username: uname, password: submittedPassword });
        setRegSuccessOpen(true);

        setMode("login");
        setFormData({
          username: uname,
          password: "",
          email: "",
          full_name: "",
          phone: "",
          business_name: "",
          business_category: "",
          address: "",
        });
      }
      setConfirmPassword("");
      setSelectedCountry("");
      setSelectedState("");
      setSelectedCity("");
      setPincode("");
      setStates([]);
      setCities([]);
      // reset agency inputs
      setAssignStates([]);
      setAssignDistricts([]);
      setSelectedDistrictAgency("");
      setAssignPincodes([]);
      setSelectedPincodeAgency("");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data ? JSON.stringify(err.response.data) : "Registration failed!";
      setErrorMsg(typeof msg === "string" ? msg : String(msg));
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
              disabled={sponsorLocked}
              sx={{ mb: 2 }}
              InputProps={{
                readOnly: sponsorLocked,
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

            {sponsorChecking && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">Validating sponsor…</Typography>
              </Box>
            )}
            {sponsorValid === true && (
              <Box sx={{ mb: 2 }}>
                <Alert severity="success" sx={{ mb: 1 }}>
                  Sponsor verified
                </Alert>
                <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "#f5f9ff", border: "1px solid #e3f2fd" }}>
                  <Typography variant="body2"><b>Sponsor ID:</b> {sponsorDisplay.username || normalizeSponsor(sponsorId) || "—"}</Typography>
                  <Typography variant="body2"><b>Name:</b> {sponsorDisplay.name || "—"}</Typography>
                  <Typography variant="body2"><b>Pincode:</b> {sponsorDisplay.pincode || "—"}</Typography>
                </Box>
              </Box>
            )}
            {sponsorValid === false && (
              <Alert severity="error" sx={{ mb: 1 }}>
                Invalid Sponsor ID. Please correct the Sponsor ID.
              </Alert>
            )}

            {/* Agency-specific region UI */}
            {(sponsorId && isSC) && (
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
              </>
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

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>District</InputLabel>
                  <Select
                    label="District"
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

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Pincode</InputLabel>
                  <Select
                    label="Pincode"
                    value={selectedPincodeAgency}
                    onChange={(e) => setSelectedPincodeAgency(e.target.value)}
                    disabled={!selectedState || !selectedDistrictAgency}
                  >
                    <MenuItem value="">-- Select --</MenuItem>
                    {(pincodeOptions || []).map((pin) => (
                      <MenuItem key={pin} value={pin}>{pin}</MenuItem>
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

            {(sponsorId && (isDistrictCat || isPC || isPincodeCat)) && (
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

            {(sponsorId && isPincodeCat) && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Pincode (under Sponsor)</InputLabel>
                <Select
                  label="Pincode (under Sponsor)"
                  value={selectedPincodeAgency}
                  onChange={(e) => setSelectedPincodeAgency(e.target.value)}
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
              label="Business Name"
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
          </>
        );
      default:
        return null;
    }
  };

  // === FINAL UI (polished) ===
  return (
    <Box className="enhanced-root"
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: { xs: "linear-gradient(180deg,#fafcff 0%,#ffffff 100%)", md: "linear-gradient(135deg,#eaf6ff 0%,#ffffff 70%)" },
      }}
    >
          <div className="bg-shapes" aria-hidden="true">
            <div className="shape-blob blob-1"></div>
            <div className="shape-blob blob-2"></div>
            <div className="shape-blob blob-3"></div>
            <div className="node node-1"></div>
            <div className="node node-2"></div>
            <div className="node node-3"></div>
          </div>

      {/* Nav */}
      <AppBar position="sticky" sx={{ backgroundColor: "transparent", color: "#fff", boxShadow: "none" }}>
        <Toolbar sx={{ gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }} onClick={() => navigate("/")}>
            <img src={LOGO} alt="Trikonekt" style={{ height: 38 }} />
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Button color="inherit" sx={{ textTransform: "none", fontWeight: 500 }} onClick={() => navigate("/")}>
            Home
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main container */}
      <Container maxWidth="sm" sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", py: { xs: 4, md: 10 } }}>
        <Paper className="enhanced-card"
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
            <Avatar src={LOGO} alt="Trikonekt" className="trikonekt-logo" sx={{ width: 64, height: 64, mx: "auto", mb: 1, bgcolor: "transparent" }} />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Tabs
            value={mode}
            onChange={(_, nv) => setMode(nv)}
            variant="fullWidth"
            TabIndicatorProps={{ sx: { backgroundColor: "#1976d2", height: 2 } }}
            sx={{ mb: 2, "& .MuiTab-root": { textTransform: "none", fontWeight: 600 } }}
          >
            <Tab label="Login" value="login" />
            <Tab label="Register" value="register" />
          </Tabs>

          <Box sx={{ mb: 2 }}>
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
                  backgroundColor: "rgba(46,125,50,0.06)",
                },
              }}
            >
              <ToggleButton value="user" aria-label="consumer" disabled={Boolean(lockedRole && lockedRole !== "user")}>
                <PersonIcon sx={{ mr: 1 }} /> Consumer
                {role === "user" && <CheckIcon sx={{ color: "#2e7d32", ml: "auto" }} />}
              </ToggleButton>
              <ToggleButton value="agency" aria-label="agency" disabled={Boolean(lockedRole && lockedRole !== "agency")}>
                <StoreIcon sx={{ mr: 1 }} /> Agency
                {role === "agency" && <CheckIcon sx={{ color: "#2e7d32", ml: "auto" }} />}
              </ToggleButton>
              <ToggleButton value="employee" aria-label="employee" disabled={Boolean(lockedRole && lockedRole !== "employee")}>
                <WorkIcon sx={{ mr: 1 }} /> Employee
                {role === "employee" && <CheckIcon sx={{ color: "#2e7d32", ml: "auto" }} />}
              </ToggleButton>
              <ToggleButton value="business" aria-label="business" disabled={Boolean(lockedRole && lockedRole !== "business")}>
                <BusinessIcon sx={{ mr: 1 }} /> Business
                {role === "business" && <CheckIcon sx={{ color: "#2e7d32", ml: "auto" }} />}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {errorMsg && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg("")}>{errorMsg}</Alert>}
          {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg("")}>{successMsg}</Alert>}

          <Box component="form" noValidate onSubmit={handleSubmit}>
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
                      disabled={sponsorLocked}
                      sx={{ mb: 1 }}
                      InputProps={{
                        readOnly: sponsorLocked,
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
                      <Box sx={{ mb: 2 }}>
                        <Alert severity="success" sx={{ mb: 1 }}>
                          Sponsor verified
                        </Alert>
                <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "#f5f9ff", border: "1px solid #e3f2fd" }}>
                  <Typography variant="body2"><b>Sponsor ID:</b> {sponsorDisplay.username || normalizeSponsor(sponsorId) || "—"}</Typography>
                  <Typography variant="body2"><b>Name:</b> {sponsorDisplay.name || "—"}</Typography>
                  <Typography variant="body2"><b>Pincode:</b> {sponsorDisplay.pincode || "—"}</Typography>
                </Box>
                      </Box>
                    )}
                    {sponsorValid === false && (
                      <Alert severity="error" sx={{ mb: 1 }}>
                        Invalid Sponsor ID. Please correct the Sponsor ID.
                      </Alert>
                    )}
                  </Box>
                )}

                {/* Hide location/pincode/branch UI for Agency registrations */}
                {!isAgency && (
                  <>
                    {autoLoading ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                        <CircularProgress size={18} />
                        <Typography variant="body2" color="text.secondary">Detecting your location…</Typography>
                      </Box>
                    ) : null}

                   
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

                    {/* <Button fullWidth variant="contained" onClick={handleFetchBranches} disabled={(pincode || "").length !== 6 || branchLoading} sx={{ mb: 2, borderRadius: 1, py: 1.05 }}>
                      {branchLoading ? <CircularProgress size={18} color="inherit" /> : "Detect Location"}
                    </Button>

                    {(manualMode || branches.length > 0) && (
                      <Box sx={{ mt: 1, display: "flex", flexDirection: "column" }}>
                        <Autocomplete
                          fullWidth
                          options={branches}
                          value={selectedBranch}
                          onChange={handleBranchSelect}
                          getOptionLabel={(opt) =>
                            opt ? `${(opt.name || opt.Name) || ""} (${(opt.district || opt.District) || ""}, ${(opt.state || opt.State) || ""})` : ""
                          }
                          renderInput={(params) => <TextField {...params} label="Select Branch" />}
                          sx={{ mb: 2 }}
                        />
                        <TextField fullWidth label="City / District" value={geoCityName} disabled sx={{ mb: 2 }} />
                        <TextField fullWidth label="State" value={stateVal} disabled sx={{ mb: 2 }} />
                        <TextField fullWidth label="Country" value={countryVal} disabled sx={{ mb: 2 }} />
                      </Box>
                    )}

                    {!manualMode && !autoLoading && (
                      <Box sx={{ mt: 1, display: "flex", flexDirection: "column" }}>
                        <TextField fullWidth label="City / District" value={geoCityName} disabled sx={{ mb: 2 }} />
                        <TextField fullWidth label="State" value={stateVal} disabled sx={{ mb: 2 }} />
                        <TextField fullWidth label="Country" value={countryVal} disabled sx={{ mb: 2 }} />
                      </Box>
                    )} */}
                  </>
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
              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: "center", justifyContent: "space-between", mb: 2, gap: 1 }}>
                <FormControlLabel
                  sx={{
                    alignItems: "center",
                    "& .MuiCheckbox-root": { mt: "-3px" },
                    "& .MuiTypography-root": { fontSize: 14, ml: 0.5, mt: "1px" },
                  }}
                  control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} size="small" />}
                  label="Remember me"
                />
                <Box sx={{ ml: { sm: 0 }, textAlign: { xs: "left", sm: "right" } }}>
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

            <Typography variant="body2" align="center" sx={{ color: "text.secondary" }}>
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <Link component="button" type="button" variant="body2" onClick={handleModeChange} sx={{ fontWeight: 700 }}>
                {isLogin ? "Register" : "Login"}
              </Link>
            </Typography>
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

      <Box sx={{ py: { xs: 2.5, md: 3 }, textAlign: "center", backgroundColor: "rgba(255,255,255,0.85) !important", color: "#000", boxShadow : "0 2px 10px rgba(0,0,0,0.06) !important" }}>
        <Typography variant="body2" sx={{ fontSize: { xs: 12, md: 14 } }}>
          © {new Date().getFullYear()} Trikonekt. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
};

export default Login;
