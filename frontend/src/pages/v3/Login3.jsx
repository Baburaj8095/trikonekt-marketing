// Login3.jsx — v3 Dark + Teal UX (logic preserved from Auth/Login.jsx)
// Notes:
// - All logic, state, API calls, and flows are kept the same as src/pages/Auth/Login.jsx
// - Only the UI/UX styling is changed to match the attached dark sketch
// - No existing files are modified; this is an additive v3 page

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
import "./V3Theme.css";

const Login3 = () => {
  // === LOGIC STATES (unchanged) ===
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

  useEffect(() => {
    if (lockedRole && role !== lockedRole) {
      setRole(lockedRole);
    }
  }, [lockedRole]);

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

  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [pincode, setPincode] = useState("");

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

  const [geoCountryName, setGeoCountryName] = useState("");
  const [geoCountryCode, setGeoCountryCode] = useState("");
  const [geoStateName, setGeoStateName] = useState("");
  const [geoCityName, setGeoCityName] = useState("");
  const geoRequestedRef = useRef(false);

  const [sponsorChecking, setSponsorChecking] = useState(false);
  const [sponsorValid, setSponsorValid] = useState(null);
  const [sponsorDisplay, setSponsorDisplay] = useState({ name: "", pincode: "", username: "" });

  const [sponsorConsumerPincodes, setSponsorConsumerPincodes] = useState([]);
  const [selectedConsumerPincode, setSelectedConsumerPincode] = useState("");

  const [consumerSponsorStates, setConsumerSponsorStates] = useState([]);
  const [consumerSponsorDistricts, setConsumerSponsorDistricts] = useState([]);
  const [consumerSelectedState, setConsumerSelectedState] = useState("");
  const [consumerSelectedDistrict, setConsumerSelectedDistrict] = useState("");
  const [consumerDistrictPincodes, setConsumerDistrictPincodes] = useState([]);
  const [consumerPinsByState, setConsumerPinsByState] = useState([]);
  const [nonAgencyDistrictPincodes, setNonAgencyDistrictPincodes] = useState([]);
  const [pinByDistrictLoadingNA, setPinByDistrictLoadingNA] = useState(false);

  const normalizeSponsor = (val) => {
    try {
      const s = String(val || "").trim();
      if (!s) return "";
      if (s.includes("://") || s.includes("?") || s.includes("=") || s.includes("/")) {
        try {
          const u = new URL(s, window.location.origin);
          const q = new URLSearchParams(u.search);
          const inner = q.get("sponsor");
          if (inner) return normalizeSponsor(inner);
        } catch (_) {
          const idx = s.indexOf("?");
          if (idx >= 0) {
            const qs = s.slice(idx + 1);
            const params = new URLSearchParams(qs);
            const inner = params.get("sponsor");
            if (inner) return normalizeSponsor(inner);
          }
        }
      }
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
  const [regSuccessOpen, setRegSuccessOpen] = useState(false);
  const [regSuccessText, setRegSuccessText] = useState({ username: "", password: "" });

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
    } catch (e) {}
  };

  useEffect(() => {
    if (mode !== "register" || role === "agency") return;
    const code = (pincode || "").trim();
    if (code.replace(/\D/g, "").length === 6) {
      fetchFromBackendPin(code);
    }
  }, [pincode, mode, role]);

  useEffect(() => {
    if (mode !== "register" || role === "agency") return;
    if (pincode.length === 6) {
      handleFetchBranches();
    }
  }, [pincode, mode, role]);

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

  useEffect(() => {
    if (mode !== "register" || role === "agency" || role === "business") {
      setManualMode(true);
      setAutoLoading(false);
      return;
    }
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
          setManualMode(true);
        } finally {
          if (!cancelled) setAutoLoading(false);
        }
      },
      (error) => {
        setManualMode(true);
        setAutoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => {
      cancelled = true;
    };
  }, [mode, role]);

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
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : "Password reset failed!");
      alert(msg);
    } finally {
      setFpLoading(false);
    }
  };

  const isLogin = true;

  useEffect(() => {
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
        let pins = [];
        try {
          const respState = await API.get("/accounts/regions/by-sponsor/", {
            params: { sponsor: s, level: "state" },
          });
          pins = respState?.data?.pincodes || [];
          setConsumerPinsByState(respState?.data?.pins_by_state || []);
        } catch (_) {}
        if (!Array.isArray(pins) || pins.length === 0) {
          const respPin = await API.get("/accounts/regions/by-sponsor/", {
            params: { sponsor: s, level: "pincode" },
          });
          pins = respPin?.data?.pincodes || [];
          setConsumerPinsByState([]);
        }
        setSponsorConsumerPincodes(pins);
        setSelectedConsumerPincode((prev) => (pins.includes(prev) ? prev : ""));
      } catch {
        setSponsorConsumerPincodes([]);
      }
    })();
  }, [mode, role, sponsorId]);

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
  const isAgency = role === "agency";
  const currentCategory = mapUIRoleToCategory();
  const isSC = currentCategory === "agency_state_coordinator";
  const isStateCat = currentCategory === "agency_state";
  const isDC = currentCategory === "agency_district_coordinator";
  const isDistrictCat = currentCategory === "agency_district";
  const isPC = currentCategory === "agency_pincode_coordinator";
  const isPincodeCat = currentCategory === "agency_pincode";
  const isSubFranchiseCat = currentCategory === "agency_sub_franchise";

  useEffect(() => {
    if (!isSubFranchiseCat) return;
    if (!selectedCountry && Array.isArray(countries) && countries.length) {
      const india = countries.find((c) => /india/i.test(c?.name || ""));
      const defaultId = india ? String(india.id) : String(countries[0].id);
      setSelectedCountry(defaultId);
      if (defaultId) {
        (async () => {
          try {
            await loadStates(defaultId);
          } catch {}
        })();
      }
    }
  }, [isSubFranchiseCat, selectedCountry, countries]);

  const [allStatesList, setAllStatesList] = useState([]);
  const [sponsorStates, setSponsorStates] = useState([]);
  const [sponsorDistricts, setSponsorDistricts] = useState([]);
  const [sponsorPincodes, setSponsorPincodes] = useState([]);
  const [districtPincodes, setDistrictPincodes] = useState([]);
  const [pinByDistrictLoading, setPinByDistrictLoading] = useState(false);
  const [assignStates, setAssignStates] = useState([]);
  const [assignDistricts, setAssignDistricts] = useState([]);
  const [selectedDistrictAgency, setSelectedDistrictAgency] = useState("");
  const [assignPincodes, setAssignPincodes] = useState([]);
  const [selectedPincodeAgency, setSelectedPincodeAgency] = useState("");

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

  useEffect(() => {
    if ((isDC || isDistrictCat || isSubFranchiseCat) && selectedState) {
      loadCities(selectedState);
    }
  }, [isDC, isDistrictCat, isSubFranchiseCat, selectedState]);

  const districtOptions = useMemo(() => {
    if (isSubFranchiseCat) {
      const fromCities = (cities || [])
        .map((c) => c?.name || c?.Name || c?.city || c?.City)
        .filter(Boolean);
      return Array.from(new Set(fromCities));
    }

    const fromSponsor = (sponsorDistricts || [])
      .filter((d) => String(d.state_id) === String(selectedState))
      .map((d) => d.district)
      .filter(Boolean);

    if (fromSponsor.length) {
      return Array.from(new Set(fromSponsor));
    }
    const fromCities = (cities || [])
      .map((c) => c?.name || c?.Name || c?.city || c?.City)
      .filter(Boolean);
    return Array.from(new Set(fromCities));
  }, [isSubFranchiseCat, sponsorDistricts, selectedState, cities]);

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

  const pincodeOptions = useMemo(() => {
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
          setErrorMsg("Please select a City.");
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

  const loginField = {
    label: "Username",
    type: "text",
    inputMode: "text",
    placeholder: "Enter username",
  };

  const prettyRole = (r) =>
    ({
      user: "Consumer",
      agency: "Agency",
      employee: "Employee",
      business: "Merchant",
    }[String(r || "").toLowerCase()] || String(r || ""));

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
      let username = (formData.username || "").trim();
      const submitRole = role;

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

      const roleEffective =
        payload?.role_effective ||
        (String(payload?.category || "").toLowerCase() === "business" ? "business" : tokenRole);

      const ns = (payload?.is_staff || payload?.is_superuser) ? "admin" : (roleEffective || tokenRole || "user");
      const store = remember ? localStorage : sessionStorage;

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
      const data = err?.response?.data;
      if (data?.multiple_accounts && Array.isArray(data.multiple_accounts)) {
        const choices = data.multiple_accounts.map((a) => a.username).join(", ");
        setErrorMsg(`Multiple accounts ambiguity. Please enter one of these usernames: ${choices}`);
      } else {
        const msg = data?.detail || (data ? JSON.stringify(data) : "Login failed!");
        setErrorMsg(typeof msg === "string" ? msg : String(msg));
      }
    }
  };

  // Registration renders (unchanged logic; minor style is applied by CSS class .v3-auth-card)
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
                  <Select label="Country" value={selectedCountry} onChange={handleCountryChange}>
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

  // === UI (dark + teal) ===
  return (
    <Box className="v3-root v3-auth" sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Box className="v3-auth-illustration" aria-hidden="true" />
      {/* Header intentionally omitted for sketch-accurate login */}

      {/* Main container */}
      <Container maxWidth="sm" sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", py: { xs: 4, md: 10 } }}>
        <Paper
          elevation={0}
          className="v3-auth-card"
          sx={{
            width: "100%",
            maxWidth: 420,
            mx: "auto",
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
          }}
        >
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Typography variant="h4" className="v3-auth-brand">Holla</Typography>
          </Box>


          <Tabs value={mode} onChange={(_, nv) => setMode(nv)} variant="fullWidth" sx={{ display: "none" }}>
            <Tab label="Login" value="login" />
            <Tab label="Register" value="register" />
          </Tabs>

          <Box sx={{ mb: 2, display: "none" }}>
            <ToggleButtonGroup value={role} exclusive onChange={handleRoleChange} fullWidth>
              <ToggleButton value="user" disabled={Boolean(lockedRole && lockedRole !== "user")}>
                Consumer {role === "user" && <CheckCircleIcon color="success" fontSize="small" style={{ marginLeft: 8 }} />}
              </ToggleButton>
              <ToggleButton value="agency" disabled={Boolean(lockedRole && lockedRole !== "agency")}>
                Agency {role === "agency" && <CheckCircleIcon color="success" fontSize="small" style={{ marginLeft: 8 }} />}
              </ToggleButton>
              <ToggleButton value="employee" disabled={Boolean(lockedRole && lockedRole !== "employee")}>
                Employee {role === "employee" && <CheckCircleIcon color="success" fontSize="small" style={{ marginLeft: 8 }} />}
              </ToggleButton>
              <ToggleButton value="business" disabled={Boolean(lockedRole && lockedRole !== "business")}>
                Merchant {role === "business" && <CheckCircleIcon color="success" fontSize="small" style={{ marginLeft: 8 }} />}
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
                size="small"
                fullWidth
                name="username"
                value={formData.username}
                placeholder="Email"
                type={loginField.type}
                inputProps={{ inputMode: loginField.inputMode }}
                onChange={handleChange}
                sx={{ mb: 2 }}
                required
                className="v3-input"
                InputLabelProps={{ shrink: false }}
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
              size="small"
              fullWidth
              name="password"
              value={formData.password}
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              onChange={handleChange}
              sx={{ mb: isLogin ? 2.5 : 3 }}
              required
              className="v3-input"
              InputLabelProps={{ shrink: false }}
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

            {isLogin && (
              <Box sx={{ width: "100%", textAlign: "right", mb: 1.5 }} className="v3-forgot-row">
                <Typography variant="caption" sx={{ color: "var(--v3-muted)" }}>
                  Forgot Password?{" "}
                  <Link component="button" type="button" onClick={() => setForgotOpen(true)} className="v3-auth-link" sx={{ fontWeight: 600 }}>
                    Recover here
                  </Link>
                </Typography>
              </Box>
            )}

            <Button
              fullWidth
              type="submit"
              onClick={(e) => handleSubmit(e)}
              variant="contained"
              className="v3-auth-accent-btn"
              sx={{
                py: 1.05,
                fontWeight: 800,
                borderRadius: 999,
                textShadow: "0 1px 0 rgba(0,0,0,0.2)",
                mb: 1.25,
              }}
            >
              {isLogin ? "LOGIN" : "REGISTER"}
            </Button>

            

            <Box sx={{ mt: 1.5, textAlign: "center" }}>
              <Typography variant="body2" sx={{ color: "var(--v3-muted)" }}>
                Don't have an account?{" "}
                <Link component="button" type="button" className="v3-auth-link" onClick={handleRegisterNav} sx={{ fontWeight: 700 }}>
                  SignUp here
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

      

      {/* Footer */}
      <Box sx={{ py: 2.5, textAlign: "center", background: "var(--v3-bg)", borderTop: "1px solid var(--v3-border)", color: "var(--v3-muted)" }}>
        <Typography variant="body2">© {new Date().getFullYear()} Trikonekt. All rights reserved.</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Contact us:{" "}
          <Link
            href="mailto:contact@trikonekt.com"
            underline="hover"
            className="v3-auth-link"
            sx={{ fontWeight: 500 }}
          >
            contact@trikonekt.com
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Login3;
