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
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
  Link,
  Autocomplete,
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
  Menu as MenuIcon,
} from "@mui/icons-material";

import { useNavigate, useParams, useLocation } from "react-router-dom";
import API, { getAccessToken } from "../../api/api";
import LOGO from "../../assets/TRIKONEKT.jpg";

// New, standalone registration page that preserves existing registration logic and APIs
// while providing a clean, isolated UI for testing safely.
const RegisterV2 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role: roleParam } = useParams();

  const allowAgencyOverride = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search || "");
      const adminFlag =
        ["1", "true", "yes"].includes(String(params.get("admin") || "").toLowerCase()) ||
        ["1", "true", "yes"].includes(String(params.get("admin_agency_override") || "").toLowerCase());
      const hasLevel = !!String(params.get("agency_level") || params.get("category") || "").trim();
      // Enable override if admin flag is present OR an explicit agency level is provided in URL.
      // Do not depend on access token to avoid cross-context issues when opened from Admin.
      return adminFlag || hasLevel;
    } catch {
      return false;
    }
  }, [location.search]);

  // Role handling
  const ALLOWED_ROLES = ["user", "agency", "employee", "business"];
  const lockedRole = ALLOWED_ROLES.includes(String(roleParam || "").toLowerCase())
    ? String(roleParam).toLowerCase()
    : null;
  const [role, setRole] = useState(lockedRole || "user");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Form + auth states
  const [formData, setFormData] = useState({
    password: "",
    email: "",
    full_name: "",
    phone: "",
    business_name: "",
    business_category: "",
    address: "",
    commission_percent: "",
    service_mode: "BOTH",
  });
  // Merchant categories (public) + dependent subcategories
  const [mCategories, setMCategories] = useState([]);
  const [mSubcategories, setMSubcategories] = useState([]);
  const [mCatId, setMCatId] = useState("");
  const [mSubcatId, setMSubcatId] = useState("");
  const [mLoading, setMLoading] = useState({ cats: false, subs: false });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Sponsor
  const [sponsorId, setSponsorId] = useState("");
  const [sponsorLocked, setSponsorLocked] = useState(false);
  const [sponsorChecking, setSponsorChecking] = useState(false);
  const [sponsorValid, setSponsorValid] = useState(null);
  const [sponsorDisplay, setSponsorDisplay] = useState({ name: "", pincode: "", username: "", usernameCanonical: "" });
  const sponsorInitRef = useRef(false);

  // Agency
  const [agencyLevel, setAgencyLevel] = useState("");
  useEffect(() => {
    if (role === "agency" && !allowAgencyOverride) {
      setAgencyLevel("sub_franchise");
    }
  }, [role, allowAgencyOverride]);
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
    if (role === "business") return "merchant";
    if (role === "employee") return "employee";
    if (role === "user") return "consumer";
    if (role === "agency") return allowAgencyOverride ? (mapAgencyLevelToCategory(agencyLevel) || "agency_state") : "agency_sub_franchise";
    return "consumer";
  };
  const prettyRole = (r) =>
    ({
      user: "Consumer",
      agency: "Agency",
      employee: "Employee",
      business: "Business",
    }[String(r || "").toLowerCase()] || String(r || ""));
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

  // Normalize API list payloads into arrays to avoid `.map is not a function`
  const toArray = (data, extraKeys = []) => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      for (const k of ["results", "data", "items", ...extraKeys]) {
        const v = data[k];
        if (Array.isArray(v)) return v;
      }
    }
    return [];
  };

  // Locations
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCityId, setSelectedCityId] = useState("");
  const [pincode, setPincode] = useState("");
  const [areaOptions, setAreaOptions] = useState([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [areaLoading, setAreaLoading] = useState(false);
  // India Post hierarchy states
  const [ipLoading, setIpLoading] = useState(false);
  const [ipError, setIpError] = useState("");
  const [ipTaluk, setIpTaluk] = useState("");
  const [ipDistrict, setIpDistrict] = useState("");
  const [ipState, setIpState] = useState("");
  const [ipCountry, setIpCountry] = useState("");
  const areaGate = useMemo(
    () =>
      role === "user" &&
      /^\d{6}$/.test(String(pincode)) &&
      Array.isArray(areaOptions) &&
      areaOptions.length > 0 &&
      !selectedArea,
    [role, pincode, areaOptions, selectedArea]
  );

  // Geo assist
  const [autoLoading, setAutoLoading] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [geoCountryName, setGeoCountryName] = useState("");
  const [geoStateName, setGeoStateName] = useState("");
  const [geoCityName, setGeoCityName] = useState("");
  const geoRequestedRef = useRef(false);
  // Pincode fetch sequencing and abort to prevent stale overwrites
  const pinReqSeqRef = useRef(0);
  const pinAbortRef = useRef(null);

  // Agency region selections/data
  const [allStatesList, setAllStatesList] = useState([]); // for State Coordinator
  const [sponsorStates, setSponsorStates] = useState([]); // states under sponsor
  const [sponsorDistricts, setSponsorDistricts] = useState([]); // districts (city names) under sponsor
  const [sponsorPincodes, setSponsorPincodes] = useState([]); // pins under sponsor
  const [assignStates, setAssignStates] = useState([]); // multi for SC
  const [assignDistricts, setAssignDistricts] = useState([]); // multi for DC
  const [selectedDistrictAgency, setSelectedDistrictAgency] = useState(""); // single for D/PC/P/SF
  const [assignPincodes, setAssignPincodes] = useState([]); // multi for PC
  const [selectedPincodeAgency, setSelectedPincodeAgency] = useState(""); // single for P/SF
  const [districtPincodes, setDistrictPincodes] = useState([]);
  const [pinByDistrictLoading, setPinByDistrictLoading] = useState(false);

  // Non-agency district pincodes
  const [nonAgencyDistrictPincodes, setNonAgencyDistrictPincodes] = useState([]);
  const [pinByDistrictLoadingNA, setPinByDistrictLoadingNA] = useState(false);

  // UI feedback
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [regSuccessOpen, setRegSuccessOpen] = useState(false);
  const [regSuccessText, setRegSuccessText] = useState({ username: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  const isAgency = role === "agency";
  const currentCategory = mapUIRoleToCategory();
  const isSC = currentCategory === "agency_state_coordinator";
  const isStateCat = currentCategory === "agency_state";
  const isDC = currentCategory === "agency_district_coordinator";
  const isDistrictCat = currentCategory === "agency_district";
  const isPC = currentCategory === "agency_pincode_coordinator";
  const isPincodeCat = currentCategory === "agency_pincode";
  const isSubFranchiseCat = currentCategory === "agency_sub_franchise";
  const useIndiaPostFlow = useMemo(() => {
    return role === "user" || role === "employee" || role === "business" || (role === "agency" && isSubFranchiseCat);
  }, [role, isSubFranchiseCat]);

  // Effects: font + lock role
  useEffect(() => {
    if (lockedRole && role !== lockedRole) setRole(lockedRole);
  }, [lockedRole]); // eslint-disable-line

  // Parse URL: role, agency_level/category, sponsor
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

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || "");
      const rp = (params.get("role") || "").toLowerCase();
      const level = (params.get("agency_level") || params.get("category") || "").toLowerCase();
      if (ALLOWED_ROLES.includes(rp)) {
        setRole(rp);
      }
      const effectiveRole = (ALLOWED_ROLES.includes(rp) ? rp : (lockedRole || role || "")).toLowerCase();
      if (effectiveRole === "agency" && level && allowAgencyOverride) {
        setAgencyLevel(level);
      }
    } catch {}
  }, [location.search, lockedRole, allowAgencyOverride]); // eslint-disable-line

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
    // mark sponsor init complete
    sponsorInitRef.current = true;
  }, []); // eslint-disable-line

  // Default sponsor for Consumer when none provided via URL
  useEffect(() => {
    try {
      // Wait until sponsor init from URL is processed
      if (!sponsorInitRef.current) return;

      if (role === "user") {
        // Do not override if sponsor present in URL
        const params = new URLSearchParams(location.search || "");
        const raw =
          params.get("agencyid") ||
          params.get("sponsor") ||
          params.get("sponsor_id") ||
          params.get("ref");
        const fromUrl = normalizeSponsor(raw || "");
        const s = normalizeSponsor(sponsorId);
        if (!s && !fromUrl) {
          setSponsorId("9999999999");
          setSponsorLocked(false); // keep editable for user to change
        }
      }
    } catch {}
  }, [role, sponsorId, location.search]); // eslint-disable-line

  // Keep URL in sync with sponsor and agency_level for deep-linking and menu navigation
  useEffect(() => {
    try {
      // Avoid rewriting URL until sponsor initialization is complete
      if (!sponsorInitRef.current) return;

      const params = new URLSearchParams(location.search || "");
      const existingRaw =
        params.get("agencyid") ||
        params.get("sponsor") ||
        params.get("sponsor_id") ||
        params.get("ref");
      const existingSponsor = normalizeSponsor(existingRaw || "");

      const nextParams = new URLSearchParams();
      const s = normalizeSponsor(sponsorId);

      // If URL already has a sponsor and our state isn't yet in sync, don't rewrite.
      if (existingSponsor && s !== existingSponsor) {
        return;
      }

      if (s) nextParams.set("sponsor", s);
      if (allowAgencyOverride) {
        nextParams.set("admin", "1");
      }
      if (role === "agency" && allowAgencyOverride) {
        if (agencyLevel) nextParams.set("agency_level", agencyLevel);
      }
      const cur = params.toString();
      const nxt = nextParams.toString();
      if (cur !== nxt) {
        const qs = nxt ? `?${nxt}` : "";
        navigate(`/auth/register-v2/${role}${qs}`, { replace: true });
      }
    } catch {}
    // eslint-disable-next-line
  }, [role, agencyLevel, sponsorId, allowAgencyOverride, location.pathname]);

  // Countries
  useEffect(() => {
    (async () => {
      try {
        const res = await API.get("/location/countries/");
        setCountries(toArray(res?.data, ["countries", "results"]));
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Merchant Categories (public)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMLoading((s) => ({ ...s, cats: true }));
      try {
        const res = await API.get("/merchant/categories/", { cacheTTL: 10000, dedupe: "cancelPrevious" });
        const arr = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        if (!cancelled) setMCategories(Array.isArray(arr) ? arr : []);
      } catch (_) {
        if (!cancelled) setMCategories([]);
      } finally {
        if (!cancelled) setMLoading((s) => ({ ...s, cats: false }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Merchant Subcategories (public) when Category changes
  useEffect(() => {
    let cancelled = false;
    setMSubcategories([]);
    setMSubcatId("");
    const cid = String(mCatId || "");
    if (!cid) return;
    (async () => {
      setMLoading((s) => ({ ...s, subs: true }));
      try {
        const res = await API.get("/merchant/subcategories/", { params: { category_id: cid }, dedupe: "cancelPrevious" });
        const arr = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        if (!cancelled) setMSubcategories(Array.isArray(arr) ? arr : []);
      } catch (_) {
        if (!cancelled) setMSubcategories([]);
      } finally {
        if (!cancelled) setMLoading((s) => ({ ...s, subs: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [mCatId]);

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

  // India Post pincode lookup to populate hierarchy (Area/Taluk/District/State/Country)
  const fetchFromIndiaPostPin = async (code) => {
    const pin = String(code || "").replace(/\D/g, "");
    if (!/^[1-9][0-9]{5}$/.test(pin)) return;

    // Invalidate any older requests and abort inflight before starting a new one
    const seq = ++pinReqSeqRef.current;
    try { pinAbortRef.current?.abort?.(); } catch (_) {}
    let controller = null;
    try {
      if (typeof AbortController !== "undefined") {
        controller = new AbortController();
        pinAbortRef.current = controller;
      }
    } catch (_) {}

    setIpLoading(true);
    setAreaLoading(true);
    setIpError("");
    try {
      // Call server-side proxy to legacy India Post endpoint to avoid Mixed Content
      const resp = await API.get(`/location/pincode/legacy/${pin}/`, { timeout: 15000, signal: controller ? controller.signal : undefined });
      // Ignore if a newer request has started
      if (seq !== pinReqSeqRef.current) return;
      const data = resp?.data;
      const body = Array.isArray(data) ? data[0] : data;
      const status = body?.Status || body?.status;
      const offices = body?.PostOffice || body?.postOffice;
      if (String(status) !== "Success" || !Array.isArray(offices) || offices.length === 0) {
        if (seq === pinReqSeqRef.current) {
          setIpError("Invalid Pincode");
          setAreaOptions([]);
          setSelectedArea("");
          setIpTaluk("");
          setIpDistrict("");
          setIpState("");
          setIpCountry("");
        }
        return;
      }
      // Area/Post Office names
      const names = Array.from(new Set((offices || []).map((o) => o?.Name || o?.name).filter(Boolean)));
      if (seq === pinReqSeqRef.current) {
        setAreaOptions(names);
        setSelectedArea("");
      }

      // Taluk/Tehsil (pick first non-empty)
      const taluks = Array.from(new Set((offices || []).map((o) => o?.Taluk || o?.taluk).filter(Boolean)));
      const taluk = taluks[0] || "";
      if (seq === pinReqSeqRef.current) setIpTaluk(taluk);

      // District/State/Country
      const dist = (offices.find((o) => o?.District) || {})?.District || "";
      const st = (offices.find((o) => o?.State) || {})?.State || "";
      const ctry = (offices.find((o) => o?.Country) || {})?.Country || "India";
      if (seq === pinReqSeqRef.current) {
        setIpDistrict(dist);
        setIpState(st);
        setIpCountry(ctry || "India");
      }

      // Feed geo-name hints so existing auto-mapping effects can map to selects
      if (seq === pinReqSeqRef.current) {
        if (dist) setGeoCityName(dist);
        if (st) setGeoStateName(st);
        setGeoCountryName(ctry || "India");
      }

      // For consumer flow, reset selects so they auto-map after Area selection
      if (seq === pinReqSeqRef.current && role === "user") {
        setSelectedCountry("");
        setSelectedState("");
        setSelectedCity("");
        setSelectedCityId("");
      }
    } catch (err) {
      // Ignore cancellations/aborts
      if (err && (err.__canceled || err.code === "ERR_CANCELED" || /aborted|abort|canceled|cancelled/i.test(String(err.message || "")))) {
        return;
      }
      // Fallback to existing backend pin lookup to preserve legacy behavior
      try { await fetchFromBackendPin(code); } catch {}
      if (seq === pinReqSeqRef.current) setIpError("Invalid Pincode");
    } finally {
      if (seq === pinReqSeqRef.current) {
        setIpLoading(false);
        setAreaLoading(false);
      }
    }
  };
  
  // Lookup location by pincode and set geo names (will be auto-mapped into selects)
  const fetchFromBackendPin = async (code) => {
    const pin = String(code || "").replace(/\D/g, "");
    if (pin.length !== 6) return;

    // Invalidate older requests and abort any inflight one
    const seq = ++pinReqSeqRef.current;
    try { pinAbortRef.current?.abort?.(); } catch (_) {}
    let controller = null;
    try {
      if (typeof AbortController !== "undefined") {
        controller = new AbortController();
        pinAbortRef.current = controller;
      }
    } catch (_) {}

    try {
      setAreaLoading(true);
      const resp = await API.get(`/location/pincode/${pin}/`, { signal: controller ? controller.signal : undefined });
      if (seq !== pinReqSeqRef.current) return;
      const payload = resp?.data || {};
      const detectedCity = payload.city || payload.district || "";
      const detectedState = payload.state || "";
      const detectedCountry = payload.country || "";

      // Populate Area options from India Post PostOffice names; fallback to villages
      const offices = Array.isArray(payload.post_offices) ? payload.post_offices : [];
      const namesFromOffices = offices.map((po) => po?.name).filter(Boolean);
      const villages = Array.isArray(payload.villages) ? payload.villages : [];
      const allNames = Array.from(new Set([...(namesFromOffices || []), ...(villages || [])]));
      if (seq === pinReqSeqRef.current) {
        setAreaOptions(allNames);
        setSelectedArea("");
      }
      if (seq === pinReqSeqRef.current && role === "user") {
        setSelectedCountry("");
        setSelectedState("");
        setSelectedCity("");
        setSelectedCityId("");
      }

      if (seq === pinReqSeqRef.current) {
        if (detectedCity) setGeoCityName(detectedCity);
        if (detectedState) setGeoStateName(detectedState);
        if (detectedCountry) setGeoCountryName(detectedCountry);
      }
    } catch (e) {
      // Ignore cancellations/aborts
      if (e && (e.__canceled || e.code === "ERR_CANCELED" || /aborted|abort|canceled|cancelled/i.test(String(e.message || "")))) {
        return;
      }
      if (seq === pinReqSeqRef.current) {
        setAreaOptions([]);
        setSelectedArea("");
      }
      // ignore other errors
    } finally {
      if (seq === pinReqSeqRef.current) setAreaLoading(false);
    }
  };

  const handlePincodeManualChange = (val) => {
    // Abort any in-flight pincode lookup and invalidate previous results
    try { pinAbortRef.current?.abort?.(); } catch (_) {}
    pinReqSeqRef.current += 1;

    const next = String(val || "").replace(/\D/g, "").slice(0, 6);
    setPincode(next);
    setSelectedArea("");
    setAreaOptions([]);
    // reset india post hierarchy fields on pincode change
    setIpError("");
    setIpTaluk("");
    setIpDistrict("");
    setIpState("");
    setIpCountry("");
  };

  // On select changes
  const handleCountryChange = (e) => {
    const value = e.target.value;
    setSelectedCountry(value);
    setSelectedState("");
    setSelectedCity("");
    setSelectedCityId("");
    setStates([]);
    setCities([]);
    setPincode("");
    setSelectedArea("");
    setAreaOptions([]);
    if (value) loadStates(value);
  };
  const handleStateChange = (e) => {
    const value = e.target.value;
    setSelectedState(value);
    setSelectedCity("");
    setSelectedCityId("");
    setCities([]);
    setPincode("");
    setSelectedArea("");
    setAreaOptions([]);
    if (value) loadCities(value);
  };

  // Auto-detect location (non-agency)
  useEffect(() => {
    if (isAgency) {
      setAutoLoading(false);
      setManualMode(true);
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
          if (cancelled) return;
          const { latitude, longitude } = pos.coords;
          const r = await API.get("/location/reverse/", { params: { lat: latitude, lon: longitude } });
          const rb = r?.data || {};
          const detectedPin = rb.pincode || "";
          const detectedState = rb.state || "";
          const detectedCountry = rb.country || "";
          const detectedCity = rb.city || rb.district || "";

          setGeoStateName(detectedState);
          setGeoCountryName(detectedCountry);
          setGeoCityName(detectedCity);

          // Pre-map into selects if available later
          // Country
          if (role !== "user" || selectedArea) {
            if (Array.isArray(countries) && countries.length) {
              const matchCountry = countries.find(
                (c) =>
                  String(c?.name || "").trim().toLowerCase() ===
                  String(detectedCountry || "").trim().toLowerCase()
              );
              if (matchCountry) {
                const id = String(matchCountry.id);
                setSelectedCountry(id);
                await loadStates(id);
              }
            }
          }
          // State
          if ((role !== "user" || selectedArea) && detectedState) {
            const st = (prevStates) =>
              (prevStates || []).find(
                (s) =>
                  String(s?.name || "").trim().toLowerCase() ===
                  String(detectedState).trim().toLowerCase()
              );
            const match = st(states);
            if (!match) {
              // wait small time for states to load
              setTimeout(() => {
                const s2 = (states || []).find(
                  (s) =>
                    String(s?.name || "").trim().toLowerCase() ===
                    String(detectedState).trim().toLowerCase()
                );
                if (s2) {
                  const sid = String(s2.id);
                  setSelectedState(sid);
                  loadCities(sid);
                }
              }, 300);
            } else {
              const sid = String(match.id);
              setSelectedState(sid);
              loadCities(sid);
            }
          }
          // City will auto map after cities load; pincode fetched on district change

          // Set pincode if valid
          const pinNorm = String(detectedPin || "").replace(/\D/g, "").slice(0, 6);
          if (/^\d{6}$/.test(pinNorm)) setPincode(pinNorm);
        } catch (e) {
          setManualMode(true);
        } finally {
          if (!cancelled) setAutoLoading(false);
        }
      },
      () => {
        setManualMode(true);
        setAutoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    return () => {
      cancelled = true;
    };
  }, [isAgency, countries]); // eslint-disable-line

  // When non-agency state+district selected: load district pincodes
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
        const rows = toArray(resp?.data, ["pincodes", "results"]);
        const pins = Array.from(
          new Set(
            rows
              .map((p) => String(p || "").replace(/\D/g, "").slice(0, 6))
              .filter((p) => /^\d{6}$/.test(p))
          )
        );
        setNonAgencyDistrictPincodes(pins);
      } catch {
        setNonAgencyDistrictPincodes([]);
      } finally {
        setPinByDistrictLoadingNA(false);
      }
    })();
  }, [isAgency, selectedCity, selectedState]); // eslint-disable-line

  // Auto-map geo detected Country -> Country select (non-agency)
  useEffect(() => {
    if (isAgency || areaGate) return;
    if (selectedCountry) return;
    const name = String(geoCountryName || "").toLowerCase();
    if (!name || !Array.isArray(countries) || !countries.length) return;
    const match = countries.find(
      (c) => String(c?.name || "").trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (match) {
      const id = String(match.id);
      setSelectedCountry(id);
      loadStates(id);
    }
  }, [isAgency, areaGate, geoCountryName, countries, selectedCountry]); // eslint-disable-line

  // Auto-map geo detected State -> State select (non-agency)
  useEffect(() => {
    if (isAgency || areaGate) return;
    if (!selectedCountry || selectedState) return;
    const name = String(geoStateName || "").toLowerCase();
    if (!name || !Array.isArray(states) || !states.length) return;
    const match = states.find(
      (s) => String(s?.name || "").trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (match) {
      const id = String(match.id);
      setSelectedState(id);
      loadCities(id);
    }
  }, [isAgency, areaGate, selectedCountry, geoStateName, states, selectedState]); // eslint-disable-line

  // Auto-map geo detected District/City -> District select (non-agency)
  useEffect(() => {
    if (isAgency || areaGate) return;
    if (!selectedState || selectedCity) return;
    const input = String(geoCityName || "");
    if (!input || !Array.isArray(cities) || !cities.length) return;
    const strip = (v) =>
      String(v || "")
        .toLowerCase()
        .replace(/\([^)]*\)/g, " ") // drop things like "(KAR)"
        .replace(/[^a-z\s]/g, " ")   // keep only letters/spaces
        .replace(/\s+/g, " ")
        .trim();
    const variants = (s) => {
      const b = strip(s);
      const map = {
        "bengaluru": ["bangalore"],
        "bengaluru urban": ["bangalore urban"],
        "bengaluru rural": ["bangalore rural"],
        "mysuru": ["mysore"],
        "shivamogga": ["shimoga"],
        "tumakuru": ["tumkur"],
        "chikkamagaluru": ["chikmagalur"],
        "belagavi": ["belgaum"],
        "vijayapura": ["bijapur", "bijapaur", "bijapura", "vijapura"],
        "ballari": ["bellary"],
        "kalaburagi": ["gulbarga", "kalaburgi"],
        "kalaburgi": ["kalaburagi", "gulbarga"],
      };
      const set = new Set([b]);
      for (const [k, arr] of Object.entries(map)) {
        if (b === k || (arr || []).includes(b)) {
          set.add(k);
          for (const x of arr) set.add(x);
        }
      }
      // also split tokens to allow partials like "bijapur kar" -> "bijapur"
      b.split(" ").forEach((tok) => tok && set.add(tok));
      return Array.from(set);
    };
    const cityList = (cities || [])
      .map((c) => c?.name || c?.Name || c?.city || c?.City)
      .filter(Boolean);
    const nlist = cityList.map((n) => ({ raw: n, key: strip(n) }));
    const vset = new Set(variants(input));
    const vlist = Array.from(vset);
    let chosen = null;
    // exact match on any variant
    for (const item of nlist) {
      if (vset.has(item.key)) {
        chosen = item.raw;
        break;
      }
    }
    // fallback: any direction substring match with any variant
    if (!chosen) {
      chosen =
        nlist.find((it) => vlist.some((v) => it.key.includes(v) || v.includes(it.key)))?.raw ||
        null;
    }
  if (chosen) {
    setSelectedCity(chosen);
    try {
      const m = (cities || []).find((c) => {
        const nm = strip(c?.name || c?.Name || c?.city || c?.City || "");
        return nm === strip(chosen);
      });
      setSelectedCityId(m && m.id != null ? String(m.id) : "");
    } catch {}
  }
  }, [isAgency, areaGate, selectedState, geoCityName, cities, selectedCity]); // eslint-disable-line

  // Auto-lookup pincode -> infer district/state/country (non-agency incl. business)
  useEffect(() => {
    if (isAgency) return;
    const code = String(pincode || "").trim();
    if (code.replace(/\D/g, "").length === 6) {
      const t = setTimeout(() => (useIndiaPostFlow ? fetchFromIndiaPostPin(code) : fetchFromBackendPin(code)), 400);
      return () => clearTimeout(t);
    }
  }, [isAgency, pincode, useIndiaPostFlow]); // eslint-disable-line

  // Sponsor live validation
  useEffect(() => {
    const s = normalizeSponsor(sponsorId);
    if (!s) {
      setSponsorValid(null);
      setSponsorDisplay({ name: "", pincode: "", username: "", usernameCanonical: "" });
      return;
    }
    setSponsorChecking(true);
    const t = setTimeout(async () => {
      let exists = false;
      let name = "";
      let pcode = "";
      let canonicalUsername = "";
      const input = s;
      try {
        let matched = false;
        // Prefer regions endpoint but only trust it if it echoes back the same username
        try {
          const r = await API.get("/accounts/regions/by-sponsor/", { params: { sponsor: input, level: "state" } });
          const sp = r?.data?.sponsor || {};
          const spUser = String(sp.username || "").trim();
          if (spUser) {
            matched = true;
            exists = true;
            canonicalUsername = spUser;
            name = sp.full_name || sp.username || "";
            pcode = sp.pincode || "";
          }
        } catch {}
        // Fallback: explicit user lookup (only if we have an access token to avoid 401 on public page)
        const hasToken = (() => {
          try { return !!getAccessToken(); } catch { return false; }
        })();
        if (!matched && hasToken) {
          try {
            const r2 = await API.get("/accounts/hierarchy/", { params: { username: input } });
            const u = r2?.data?.user || r2?.data || {};
            const uUser = String(u?.username || "").trim();
            if (uUser && uUser.toLowerCase() === input.toLowerCase()) {
              exists = true;
              name = u.full_name || "";
              pcode = u.pincode || "";
            }
          } catch {}
        }
      } finally {
        // If backend returns mismatched sponsor (e.g., TRIKONEKT), treat as "unknown" (null) instead of invalid (false)
        // so registration isn't blocked and we keep the URL-provided sponsor visible.
        setSponsorValid(exists ? true : null);
        // Display the entered sponsor value (e.g., 8095918105) as the visible Sponsor ID,
        // while still using backend data for name/pincode and canonical username (if any).
        setSponsorDisplay({ name: exists ? name : "", pincode: exists ? pcode : "", username: input, usernameCanonical: canonicalUsername });
        setSponsorChecking(false);
      }
    }, 450);
    return () => {
      setSponsorChecking(false);
      clearTimeout(t);
    };
  }, [sponsorId]); // eslint-disable-line

  // Agency: load all states (for State Coordinator)
  useEffect(() => {
    if (!isSC) return;
    (async () => {
      try {
        // If a country is selected, fetch its states list as reference list
        let countryId = selectedCountry;
        if (!countryId && countries && countries.length) {
          const india = countries.find((c) => /india/i.test(c?.name || ""));
          countryId = india ? String(india.id) : String(countries[0].id);
          setSelectedCountry(countryId);
        }
        if (countryId) {
          const resp = await API.get(`/location/states/`, { params: { country: countryId } });
          const rows = toArray(resp?.data, ["states", "results"]);
          const norm = rows.map((r) => ({ id: r.id, name: r.name }));
          setAllStatesList(norm);
        } else {
          setAllStatesList([]);
        }
      } catch {
        setAllStatesList([]);
      }
    })();
  }, [isSC, selectedCountry, countries]); // eslint-disable-line

  // Agency: sponsor states
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
        const rows = toArray(resp?.data, ["states", "results"]);
        setSponsorStates(rows);
      } catch {
        setSponsorStates([]);
      }
    })();
  }, [isAgency, sponsorId, currentCategory]); // eslint-disable-line

  // Agency: sponsor districts for selected state
  useEffect(() => {
    if (!(isDC || isDistrictCat || isPC || isPincodeCat)) {
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
        const rows = toArray(resp?.data, ["districts", "results"]);
        setSponsorDistricts(rows);
      } catch {
        setSponsorDistricts([]);
      }
    })();
  }, [isDC, isDistrictCat, isPC, isPincodeCat, sponsorId, selectedState]); // eslint-disable-line

  // Agency: load district list from cities for sub-franchise and for (state/district) fallbacks
  useEffect(() => {
    if ((isDC || isDistrictCat || isSubFranchiseCat || isPC || isPincodeCat) && selectedState) {
      loadCities(selectedState);
    }
  }, [isDC, isDistrictCat, isSubFranchiseCat, isPC, isPincodeCat, selectedState]); // eslint-disable-line

  // Auto-map India Post hierarchy to agency Sub-Franchise assignment (hidden UI)
  useEffect(() => {
    if (!isSubFranchiseCat) return;
    const target = String(ipCountry || "India").trim().toLowerCase();
    if (!selectedCountry && Array.isArray(countries) && countries.length) {
      const m = countries.find((c) => String(c?.name || "").trim().toLowerCase() === target);
      if (m) {
        const id = String(m.id);
        setSelectedCountry(id);
        loadStates(id);
      }
    }
  }, [isSubFranchiseCat, ipCountry, countries, selectedCountry]); // eslint-disable-line

  useEffect(() => {
    if (!isSubFranchiseCat) return;
    if (!selectedCountry || !ipState) return;
    if (Array.isArray(states) && states.length) {
      const m = states.find(
        (s) => String(s?.name || "").trim().toLowerCase() === String(ipState).trim().toLowerCase()
      );
      if (m && String(selectedState) !== String(m.id)) {
        const sid = String(m.id);
        setSelectedState(sid);
        loadCities(sid);
      }
    }
  }, [isSubFranchiseCat, selectedCountry, ipState, states, selectedState]); // eslint-disable-line

  useEffect(() => {
    if (!isSubFranchiseCat) return;
    if (!selectedState || !ipDistrict) return;
    if (!selectedDistrictAgency) {
      setSelectedDistrictAgency(String(ipDistrict));
    }
  }, [isSubFranchiseCat, selectedState, ipDistrict, selectedDistrictAgency]); // eslint-disable-line

  useEffect(() => {
    if (!isSubFranchiseCat) return;
    const pin = String(pincode || "").replace(/\D/g, "");
    if (/^\d{6}$/.test(pin)) {
      setSelectedPincodeAgency(pin);
    }
  }, [isSubFranchiseCat, pincode]); // eslint-disable-line

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
    if (fromSponsor.length) return Array.from(new Set(fromSponsor));
    const fromCities = (cities || [])
      .map((c) => c?.name || c?.Name || c?.city || c?.City)
      .filter(Boolean);
    return Array.from(new Set(fromCities));
  }, [isSubFranchiseCat, sponsorDistricts, selectedState, cities]); // eslint-disable-line

  // Agency: sponsor pins
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
        const rows = toArray(resp?.data, ["pincodes", "results"]);
        const pins = Array.from(
          new Set(
            rows
              .map((p) => String(p || "").replace(/\D/g, "").slice(0, 6))
              .filter((p) => /^\d{6}$/.test(p))
          )
        );
        setSponsorPincodes(pins);
      } catch {
        setSponsorPincodes([]);
      }
    })();
  }, [isPC, isPincodeCat, isSubFranchiseCat, sponsorId]); // eslint-disable-line

  // Agency: district pins
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
        const rows = toArray(resp?.data, ["pincodes", "results"]);
        const pins = Array.from(
          new Set(
            rows
              .map((p) => String(p || "").replace(/\D/g, "").slice(0, 6))
              .filter((p) => /^\d{6}$/.test(p))
          )
        );
        setDistrictPincodes(pins);
        setAssignPincodes((prev) => (Array.isArray(prev) ? prev.filter((p) => pins.includes(p)) : []));
        if (selectedPincodeAgency && !pins.includes(selectedPincodeAgency)) {
          setSelectedPincodeAgency("");
        }
      } catch {
        setDistrictPincodes([]);
      } finally {
        setPinByDistrictLoading(false);
      }
    })();
  }, [isPC, isPincodeCat, isSubFranchiseCat, selectedDistrictAgency, selectedState]); // eslint-disable-line

  // Intersect pins for agency selection (except sub-franchise which can list all district pins)
  const pincodeOptions = useMemo(() => {
    if (isSubFranchiseCat) return Array.isArray(districtPincodes) ? districtPincodes : [];
    const hasDistrict = Array.isArray(districtPincodes) && districtPincodes.length > 0;
    const hasSponsor = Array.isArray(sponsorPincodes) && sponsorPincodes.length > 0;
    if (hasDistrict && hasSponsor) {
      const ss = new Set(sponsorPincodes);
      return districtPincodes.filter((p) => ss.has(p));
    }
    return hasDistrict ? districtPincodes : sponsorPincodes;
  }, [isSubFranchiseCat, districtPincodes, sponsorPincodes]); // eslint-disable-line

  const handleRoleChange = (_, v) => {
    if (lockedRole) return;
    if (v) setRole(v);
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
      setFormData((fd) => ({ ...fd, [name]: digits }));
    } else {
      setFormData((fd) => ({ ...fd, [name]: value }));
    }
  };
  const handleSetRole = (r) => {
    setRole(r);
    try {
      const params = new URLSearchParams(location.search || "");
      const s = normalizeSponsor(params.get("sponsor") || sponsorId);
      const parts = [];
      if (s) parts.push(`sponsor=${encodeURIComponent(s)}`);
      if (allowAgencyOverride) parts.push("admin=1");
      if (String(r).toLowerCase() === "agency") {
        const lvl = (agencyLevel || params.get("agency_level") || params.get("category") || "").toString();
        if (lvl) parts.push(`agency_level=${encodeURIComponent(lvl)}`);
      }
      const qs = parts.length ? `?${parts.join("&")}` : "";
      navigate(`/auth/register-v2/${r}${qs}`, { replace: true });
    } catch {}
    setDrawerOpen(false);
  };

  // Validation for agency inputs
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
    const phoneDigits = String(formData.phone || "").replace(/\D/g, "").slice(0, 10);
    if (!phoneDigits || phoneDigits.length !== 10) {
      setErrorMsg("Enter a valid 10-digit phone number.");
      return;
    }
    if (role === "business") {
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
      if (allowAgencyOverride) {
        setErrorMsg("Select Agency Registration Type");
        return;
      } else {
        setAgencyLevel("sub_franchise");
      }
    }
    if (!sponsorId) {
      setErrorMsg("Sponsor Username is required");
      return;
    }
    if (sponsorValid !== true) {
      setErrorMsg("Sponsor not found. Please enter a valid Sponsor Username/code/phone that exists.");
      return;
    }
    if (AGENCY_CATEGORIES.has(category) && !validateAgencyInputs()) {
      return;
    }
    // For non-agency, ensure location selections
    if (!AGENCY_CATEGORIES.has(category)) {
      // In IndiaPost mode we rely on postal-derived hierarchy fields (ip*) and send names to backend.
      // Do NOT block submission on selectedCountry/selectedState/selectedCity because those are derived
      // via name-matching and can fail for spelling variants (e.g., Davangere/Davanagere).
      const pinOk = /^\d{6}$/.test(String(pincode || "").replace(/\D/g, ""));
      if (!pinOk) {
        setErrorMsg("Please enter a valid 6-digit Pincode");
        return;
      }

      // Require explicit Area selection when pincode resolves to post offices
      if (Array.isArray(areaOptions) && areaOptions.length > 0 && !selectedArea) {
        setErrorMsg("Please select Area (Post Office)");
        return;
      }

      // In manual (non-IndiaPost) mode, still require explicit selects.
      if (!useIndiaPostFlow) {
        if (!selectedCountry || !selectedState || !selectedCity) {
          setErrorMsg("Please select Country, State and District");
          return;
        }
      } else {
        // IndiaPost mode: ensure postal hierarchy resolved
        if (!String(ipState || "").trim() || !String(ipDistrict || "").trim()) {
          setErrorMsg("Please enter a valid Pincode to auto-fill State and District");
          return;
        }
      }
    }

    // Resolve cityId strictly as a numeric PK before building payload
    let cityId = selectedCityId && /^\d+$/.test(String(selectedCityId)) ? Number(selectedCityId) : null;
    try {
      if (!cityId) {
        const pinNorm = String(pincode || "").replace(/\D/g, "");
        if (pinNorm.length === 6) {
          const pinResp = await API.get(`/location/pincode/${pinNorm}/`);
          const pb = pinResp?.data || {};
          if (pb?.city_id) {
            cityId = Number(pb.city_id);
          }
        }
      }
      if (!cityId && selectedState && selectedCity) {
        const cResp = await API.get("/location/cities/", { params: { state: selectedState } });
        const rows = Array.isArray(cResp?.data) ? cResp.data : cResp?.data?.results || [];
        const norm = (v) => String(v || "").trim().toLowerCase();
        const match = rows.find((c) => {
          const nm = c?.name || c?.Name || c?.city || c?.City;
          return norm(nm) === norm(selectedCity);
        });
        if (match) {
          const idCandidate = match.id ?? match.city_id ?? match.pk;
          if (idCandidate != null) cityId = Number(idCandidate);
        }
      }
    } catch {}

    // Resolve effective sponsor for submission
    let effectiveSponsor = normalizeSponsor(sponsorId) || "";
    if (sponsorValid === true) {
      effectiveSponsor = sponsorDisplay.usernameCanonical || effectiveSponsor;
    }

    // Build payload
    const payload = {
      password: formData.password,
      email: formData.email || "",
      full_name: formData.full_name || "",
      phone: phoneDigits,
      sponsor_id: effectiveSponsor,
      category,
      // Persist Area (Post Office / Village) chosen on the registration screen
      area: selectedArea || "",
    };

    if (!AGENCY_CATEGORIES.has(category)) {
      // In IndiaPost mode, prefer sending postal-derived names to backend so it can resolve FKs.
      // This avoids fragile frontend name->id matching.
      if (useIndiaPostFlow) {
        Object.assign(payload, {
          pincode,
          country_name: String(ipCountry || geoCountryName || "India"),
          state_name: String(ipState || geoStateName || ""),
          city_name: String(ipDistrict || geoCityName || ""),
          // IDs are optional; omit to let backend derive.
        });
      } else {
        Object.assign(payload, {
          country: selectedCountry || null,
          state: selectedState || null,
          city: cityId ?? (selectedCityId && /^\d+$/.test(String(selectedCityId)) ? Number(selectedCityId) : null),
          pincode,
          country_name: geoCountryName || "",
          state_name: geoStateName || "",
          city_name: geoCityName || "",
        });
      }
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

    setSubmitting(true);
    try {
      const submittedPassword = formData.password;
      if (role === "business") {
        // 1) Create login-enabled Merchant user via Accounts API (category will be "merchant")
        const resp = await API.post("/accounts/register/", payload, { timeout: 45000 });
        const data = resp?.data || {};
        const unameRaw = data.username || "(generated)";
        const uname = (category === "consumer")
          ? String(formData.phone || "").replace(/\D/g, "").slice(0, 10)
          : unameRaw;

        // 2) Fire-and-forget: also persist business profile for admin workflow
        (async () => {
          try {
            const brPayload = {
              full_name: formData.full_name || "",
              email: formData.email || "",
              phone: formData.phone || "",
              business_name: formData.business_name || "",
              business_category: formData.business_category || "",
              address: formData.address || "",
              commission_percent: (() => { const v = parseFloat(formData.commission_percent); return Number.isFinite(v) ? v : 0; })(),
              service_mode: ["ONLINE","OFFLINE","BOTH"].includes(String(formData.service_mode || "").toUpperCase()) ? String(formData.service_mode).toUpperCase() : "BOTH",
              sponsor_id: normalizeSponsor(sponsorId) || "",
              country: selectedCountry || null,
              state: selectedState || null,
              city: cityId ?? (selectedCityId && /^\d+$/.test(String(selectedCityId)) ? Number(selectedCityId) : null),
              pincode,
              country_name: geoCountryName || "",
              state_name: geoStateName || "",
              city_name: geoCityName || "",
            };
            await API.post("/business/register/", brPayload);
          } catch (_) {}
        })();

        // Success dialog like Agency/Consumer
        setSuccessMsg(`Welcome to Trikonekt!\nUsername: ${uname}\nPassword: ${submittedPassword}`);
        setRegSuccessText({ username: uname, password: submittedPassword });
        setRegSuccessOpen(true);
      } else {
        const resp = await API.post("/accounts/register/", payload, { timeout: 45000 });
        const data = resp?.data || {};
        const unameRaw = data.username || "(generated)";
        const uname = (category === "consumer")
          ? String(formData.phone || "").replace(/\D/g, "").slice(0, 10)
          : unameRaw;
        setSuccessMsg(`Welcome to Trikonekt!\nUsername: ${uname}\nPassword: ${submittedPassword}`);
        setRegSuccessText({ username: uname, password: submittedPassword });
        setRegSuccessOpen(true);
      }
      // Reset fields (common)
      setFormData({
        password: "",
        email: "",
        full_name: "",
        phone: "",
        business_name: "",
        business_category: "",
        address: "",
        commission_percent: "",
        service_mode: "BOTH",
      });
      setConfirmPassword("");
      setSelectedCountry("");
      setSelectedState("");
      setSelectedCity("");
      setPincode("");
      setSelectedArea("");
      setAreaOptions([]);
      setStates([]);
      setCities([]);
      // reset agency inputs
      setAssignStates([]);
      setAssignDistricts([]);
      setSelectedDistrictAgency("");
      setAssignPincodes([]);
      setSelectedPincodeAgency("");

      
    } catch (err) {
      try {
        const data = err?.response?.data;
        if (data && typeof data === "object") {
          const first = (k) => {
            const v = data[k];
            if (Array.isArray(v)) return v[0];
            if (typeof v === "string") return v;
            return null;
          };
          const parts = [];
          const sponsorErr = first("sponsor_id");
          const phoneErr = first("phone");
          const countryErr = first("country");
          const stateErr = first("state");
          const cityErr = first("city");
          const pincodeErr = first("pincode");
          const categoryErr = first("category");
          const detailErr = first("detail");
          if (sponsorErr) parts.push(`Sponsor: ${sponsorErr}`);
          if (phoneErr) parts.push(`Phone: ${phoneErr}`);
          if (countryErr) parts.push(`Country: ${countryErr}`);
          if (stateErr) parts.push(`State: ${stateErr}`);
          if (cityErr) parts.push(`District: ${cityErr}`);
          if (pincodeErr) parts.push(`Pincode: ${pincodeErr}`);
          if (categoryErr) parts.push(`Category: ${categoryErr}`);
          if (detailErr) parts.push(detailErr);
          setErrorMsg(parts.length ? parts.join(" | ") : JSON.stringify(data));
        } else {
          setErrorMsg("Registration failed!");
        }
      } catch {
        const msg =
          err?.response?.data ? JSON.stringify(err.response.data) : "Registration failed!";
        setErrorMsg(typeof msg === "string" ? msg : String(msg));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Render India Post hierarchy block (Pincode → Area → Taluk → District → State → Country)
  const renderHierarchyFields = () => {
    const validPin = /^[1-9][0-9]{5}$/.test(String(pincode || ""));
    const disabled = !validPin || ipLoading;
    return (
      <>
        <TextField
          fullWidth
          label="Pincode"
          value={pincode}
          onChange={(e) => handlePincodeManualChange(e.target.value)}
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
          helperText="Enter pincode to auto-fill location"
          sx={{ mb: 2 }}
          required
        />

        {ipLoading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Fetching location...
            </Typography>
          </Box>
        )}

        {ipError && (
          <Alert severity="error" sx={{ mb: 1 }}>{ipError}</Alert>
        )}

        {validPin && (Array.isArray(areaOptions) && areaOptions.length > 0) && (
          areaOptions.length > 10 ? (
            <Autocomplete
              freeSolo={false}
              options={(areaOptions || []).map(String)}
              value={String(selectedArea || "")}
              onChange={(_, newValue) => setSelectedArea(newValue || "")}
              onInputChange={(_, newInputValue) => {}}
              isOptionEqualToValue={(option, value) => String(option) === String(value)}
              disabled={disabled}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  label="Post Office / Village"
                  required
                  sx={{ mb: 2 }}
                />
              )}
            />
          ) : (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Post Office / Village</InputLabel>
              <Select
                label="Post Office / Village"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                required
                disabled={disabled}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {(areaOptions || []).map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )
        )}

        <TextField
          fullWidth
          label="Taluk / Tehsil"
          value={ipTaluk}
          onChange={(e) => setIpTaluk(e.target.value)}
          sx={{ mb: 2 }}
          disabled
        />

        <TextField
          fullWidth
          label="District"
          value={ipDistrict}
          sx={{ mb: 2 }}
          disabled
        />

        <TextField
          fullWidth
          label="State"
          value={ipState}
          sx={{ mb: 2 }}
          disabled
        />

        <TextField
          fullWidth
          label="Country"
          value={ipCountry || "India"}
          sx={{ mb: 2 }}
          disabled
        />
      </>
    );
  };
  
  // Render registration fields by role
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
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon />
                  </InputAdornment>
                ),
              }}
            />
            {useIndiaPostFlow && renderHierarchyFields()}
            <Box sx={{ display: useIndiaPostFlow ? "none" : "block" }}>
            {selectedCity && (nonAgencyDistrictPincodes || []).length > 0 ? (
              <Autocomplete
                freeSolo
                options={(nonAgencyDistrictPincodes || []).map(String)}
                value={String(pincode || "")}
                onInputChange={(_, newInputValue) => handlePincodeManualChange(newInputValue)}
                onChange={(_, newValue) => handlePincodeManualChange(newValue || "")}
                isOptionEqualToValue={(option, value) => String(option) === String(value)}
                disabled={!selectedCity || pinByDistrictLoadingNA}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Pincode"
                    inputProps={{
                      ...params.inputProps,
                      inputMode: "numeric",
                      pattern: "[0-9]*",
                      maxLength: 6,
                    }}
                    helperText={role === "user" ? "Enter 6-digit pincode, then select Area to populate District/State/Country" : "Enter 6-digit pincode to auto-select District/State/Country"}
                    sx={{ mb: 2 }}
                    required
                  />
                )}
              />
            ) : (
              <TextField
                fullWidth
                label="Pincode"
                value={pincode}
                onChange={(e) => handlePincodeManualChange(e.target.value)}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                helperText={role === "user" ? "Enter 6-digit pincode, then select Area to populate District/State/Country" : "Enter 6-digit pincode to auto-select District/State/Country"}
                sx={{ mb: 2 }}
                required
              />
            )}


            {/^\d{6}$/.test(String(pincode)) && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Area -</InputLabel>
                <Select
                  label="Area"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  required
                  disabled={areaLoading || (areaOptions || []).length === 0}
                >
                  <MenuItem value="">-- Select --</MenuItem>
                  {(areaOptions || []).map((name) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

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
                  } catch {}
                  setPincode("");
                  setSelectedArea("");
                  setAreaOptions([]);
                }}
                required
                disabled={areaGate || !selectedState}
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
              <InputLabel>State</InputLabel>
              <Select
                label="State"
                value={selectedState}
                onChange={handleStateChange}
                required
                disabled={areaGate || !selectedCountry}
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
              <InputLabel>Country</InputLabel>
              <Select
                label="Country"
                value={selectedCountry}
                onChange={handleCountryChange}
                disabled={areaGate}
                required
              >
                {(countries || []).map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            </Box>
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
                  <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
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
                  <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Commission Percentage (%)"
              name="commission_percent"
              value={formData.commission_percent}
              onChange={handleChange}
              sx={{ mb: 2 }}
              type="number"
              inputProps={{ min: 0, max: 100, step: 0.01 }}
              required
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Service Mode</InputLabel>
              <Select
                label="Service Mode"
                value={formData.service_mode}
                onChange={(e) => setFormData((fd) => ({ ...fd, service_mode: String(e.target.value) }))}
                required
              >
                <MenuItem value="BOTH">Both</MenuItem>
                <MenuItem value="ONLINE">Online</MenuItem>
                <MenuItem value="OFFLINE">Offline</MenuItem>
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
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
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
            {useIndiaPostFlow && renderHierarchyFields()}
            <Box sx={{ display: useIndiaPostFlow ? "none" : "block" }}>
            {selectedCity && (nonAgencyDistrictPincodes || []).length > 0 ? (
              <Autocomplete
                freeSolo
                options={(nonAgencyDistrictPincodes || []).map(String)}
                value={String(pincode || "")}
                onInputChange={(_, newInputValue) => handlePincodeManualChange(newInputValue)}
                onChange={(_, newValue) => handlePincodeManualChange(newValue || "")}
                isOptionEqualToValue={(option, value) => String(option) === String(value)}
                disabled={!selectedCity || pinByDistrictLoadingNA}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Pincode"
                    inputProps={{
                      ...params.inputProps,
                      inputMode: "numeric",
                      pattern: "[0-9]*",
                      maxLength: 6,
                    }}
                    helperText={role === "user" ? "Enter 6-digit pincode, then select Area to populate District/State/Country" : "Enter 6-digit pincode to auto-select District/State/Country"}
                    sx={{ mb: 2 }}
                    required
                  />
                )}
              />
            ) : (
              <TextField
                fullWidth
                label="Pincode"
                value={pincode}
                onChange={(e) => handlePincodeManualChange(e.target.value)}
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                helperText={role === "user" ? "Enter 6-digit pincode, then select Area to populate District/State/Country" : "Enter 6-digit pincode to auto-select District/State/Country"}
                sx={{ mb: 2 }}
                required
              />
            )}

            {/^\d{6}$/.test(String(pincode)) && (
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Area -</InputLabel>
                <Select
                  label="Area"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  required
                  disabled={areaLoading || (areaOptions || []).length === 0}
                >
                  <MenuItem value="">-- Select --</MenuItem>
                  {(areaOptions || []).map((name) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

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
                  } catch {}
                  setPincode("");
                  setSelectedArea("");
                  setAreaOptions([]);
                }}
                required
                disabled={areaGate || !selectedState}
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
              <InputLabel>State</InputLabel>
              <Select
                label="State"
                value={selectedState}
                onChange={handleStateChange}
                required
                disabled={areaGate || !selectedCountry}
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
              <InputLabel>Country</InputLabel>
              <Select
                label="Country"
                value={selectedCountry}
                onChange={handleCountryChange}
                disabled={areaGate}
                required
              >
                {(countries || []).map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            </Box>
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
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneIcon />
                  </InputAdornment>
                ),
              }}
            />
            {allowAgencyOverride ? (
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
                  disabled
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
            ) : (
              <TextField
                fullWidth
                label="Registration Type"
                value="Sub Franchise"
                disabled
                sx={{ mb: 2 }}
              />
            )}


            {isSC && (
              <>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Country</InputLabel>
                  <Select
                    label="Country"
                    value={selectedCountry}
                    onChange={handleCountryChange}
                  >
                    {(countries || []).map((c) => (
                      <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
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
                      <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="text.secondary">Select up to 2 states.</Typography>
                </FormControl>
              </>
            )}

            {(isSubFranchiseCat) && (
              <Box sx={{ mb: 2 }}>
                {renderHierarchyFields()}
              </Box>
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
                  }}
                >
                  <MenuItem value="">-- Select --</MenuItem>
                  {(sponsorStates || []).map((s) => (
                    <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
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
                    <MenuItem key={d} value={d}>{d}</MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">Select up to 2 districts.</Typography>
              </FormControl>
            )}

            {(isDistrictCat || isPC || isPincodeCat) && (
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
                    <MenuItem key={pin} value={pin}>{pin}</MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary">Select up to 4 pincodes.</Typography>
              </FormControl>
            )}

            {isPincodeCat && (
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
      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: { xs: "linear-gradient(180deg,#fafcff 0%,#ffffff 100%)", md: "linear-gradient(135deg,#eaf6ff 0%,#ffffff 70%)" },
      }}
    >
      <AppBar position="sticky" color="default" elevation={0} sx={{ backgroundColor: "#ffffff", color: "#0f172a", borderBottom: "1px solid #e2e8f0" }}>
        <Toolbar sx={{ gap: 2 }}>
          <IconButton edge="start" color="inherit" onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/"))}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, cursor: "pointer" }} onClick={() => navigate("/")}>
            <img src={LOGO} alt="Trikonekt" style={{ height: 32 }} />
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Button color="inherit" sx={{ textTransform: "none", fontWeight: 600, mr: 1 }} onClick={() => setDrawerOpen(true)}>
            {prettyRole(role)}
          </Button>
          <IconButton color="inherit" onClick={() => setDrawerOpen(true)} aria-label="open menu">
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", py: { xs: 4, md: 10 } }}>
        <Paper
          elevation={3}
          sx={{
            width: "100%",
            maxWidth: 440,
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
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
              Register
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

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
              <ToggleButton value="business" aria-label="business" disabled={Boolean(lockedRole && lockedRole !== "business")}>
                <Box sx={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <BusinessIcon sx={{ mr: 1 }} /> Business
                  </Box>
                  {role === "business" && <CheckCircleIcon color="success" fontSize="small" />}
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg("")}>
              {errorMsg}
            </Alert>
          )}
          {successMsg && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg("")}>
              {successMsg}
            </Alert>
          )}

          <Box component="form" noValidate onSubmit={handleSubmit} className="auth-mobile-full">
            {/* Sponsor - FIRST */}
            <Box sx={{ textAlign: "left" }}>
              <TextField
                fullWidth
                label="Sponsor Username"
                value={sponsorId}
                onChange={(e) => setSponsorId(e.target.value)}
                required
                disabled={sponsorLocked}
                sx={{ mb: 1.5 }}
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
                  <Typography variant="body2" color="text.secondary">
                    Validating sponsor...
                  </Typography>
                </Box>
              )}
              {sponsorValid === true && (
                <Box sx={{ mb: 2 }}>
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Sponsor verified
                  </Alert>
                  <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "#f5f9ff", border: "1px solid #e3f2fd" }}>
                    <Typography variant="body2">
                      <b>Sponsor ID:</b> {sponsorDisplay.username || sponsorId}
                    </Typography>
                    {Boolean(sponsorDisplay.usernameCanonical) && (
                      <Typography variant="body2">
                        <b>Username:</b> {sponsorDisplay.usernameCanonical}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <b>Name:</b> {sponsorDisplay.name || ""}
                    </Typography>
                    <Typography variant="body2">
                      <b>Pincode:</b> {sponsorDisplay.pincode || ""}
                    </Typography>
                  </Box>
                </Box>
              )}
              {sponsorValid === false && (
                <Alert severity="error" sx={{ mb: 1 }}>
                  Invalid Sponsor ID. Please correct the Sponsor ID.
                </Alert>
              )}
            </Box>

            {/* Role-specific fields */}
            <Box sx={{ textAlign: "left" }}>{renderRegistrationFields()}</Box>

            {/* Passwords */}
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

            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={submitting}
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
              {submitting ? "REGISTERING..." : "REGISTER"}
            </Button>

            <Typography variant="body2" align="center" sx={{ color: "text.secondary" }}>
              Already have an account?{" "}
              <Link onClick={() => navigate(`/auth/login/${role}`)} sx={{ fontWeight: 700, cursor: "pointer" }}>
                Login
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
        </Paper>
      </Container>

      {/* Category Drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 280 }} role="presentation" onKeyDown={(e) => e.key === "Escape" && setDrawerOpen(false)}>
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="h6">Select Category</Typography>
            <Typography variant="body2" color="text.secondary">Choose the category to register.</Typography>
          </Box>
          <Divider />
          <List>
            <ListItemButton selected={role === "user"} onClick={() => handleSetRole("user")}>
              <ListItemIcon><PersonIcon /></ListItemIcon>
              <ListItemText primary="Consumer" />
            </ListItemButton>
            <ListItemButton selected={role === "agency"} onClick={() => handleSetRole("agency")}>
              <ListItemIcon><StoreIcon /></ListItemIcon>
              <ListItemText primary="Sub Franchise" />
            </ListItemButton>
            <ListItemButton selected={role === "employee"} onClick={() => handleSetRole("employee")}>
              <ListItemIcon><WorkIcon /></ListItemIcon>
              <ListItemText primary="Sarathi" />
            </ListItemButton>
            <ListItemButton selected={role === "business"} onClick={() => handleSetRole("business")}>
              <ListItemIcon><BusinessIcon /></ListItemIcon>
              <ListItemText primary="Merchant" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      <Box
        sx={{
          py: { xs: 2.5, md: 3 },
          textAlign: "center",
          backgroundColor: "rgba(255,255,255,0.85) !important",
          color: "#000",
          boxShadow: "0 0px 15px rgba(0,0,0,0.08) !important",
        }}
      >
        <Typography variant="body2">© {new Date().getFullYear()} Trikonekt. All rights reserved.</Typography>
      </Box>
    </Box>
  );
};

export default RegisterV2;
