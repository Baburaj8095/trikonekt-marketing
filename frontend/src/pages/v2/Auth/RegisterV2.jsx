/**
 * RegisterV2 — UI-only refactor (step-based mobile flow)
 * STRICT: No functional changes made.
 * - All logic, API calls, validations, field names, sponsor logic, and payloads are preserved.
 * - Only the layout is restructured into 3 visual steps with mobile-first styling.
 * - Final submission still uses the existing handleSubmit, unchanged.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Typography,
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
  Link,
} from "@mui/material";

import {
  Visibility,
  VisibilityOff,
  Lock as LockIcon,
} from "@mui/icons-material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { Stepper, Step, StepLabel, StepConnector } from "@mui/material";
import { styled } from "@mui/material/styles";

import { useNavigate, useParams, useLocation } from "react-router-dom";
import API from "../../../api/api";
// Focused auth screen (no website nav)
import V2Button from "../components/V2Button";
import "../styles/v2-theme.css";

/**
 * Visual-only refactor to a 3-step, mobile-first layout:
 * Step 1 — Basic Info (+ Role Select dropdown + Sponsor)
 * Step 2 — Location (and Agency territory/assignment where applicable)
 * Step 3 — Account Security (Password/Confirm + Submit)
 *
 * Important:
 * - All business/agency logic, effects and API payloads remain intact.
 * - Continue/Back are type="button" (UI navigation only).
 * - Only "Sign Up" is type="submit" to trigger the existing handleSubmit.
 */
const RegisterV2 = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role: roleParam } = useParams();

  const [step, setStep] = useState(0);

  // Role handling
  const ALLOWED_ROLES = ["user", "agency", "employee", "business"];
  const lockedRole = ALLOWED_ROLES.includes(String(roleParam || "").toLowerCase())
    ? String(roleParam).toLowerCase()
    : null;
  const [role, setRole] = useState(lockedRole || "user");
  const [roleLockedUI, setRoleLockedUI] = useState(Boolean(lockedRole));

  // Form + auth states
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

  // Sponsor
  const [sponsorId, setSponsorId] = useState("");
  const [sponsorLocked, setSponsorLocked] = useState(false);
  const [sponsorChecking, setSponsorChecking] = useState(false);
  const [sponsorValid, setSponsorValid] = useState(null);
  const [sponsorDisplay, setSponsorDisplay] = useState({ name: "", pincode: "", username: "" });
  // Default company sponsor when not provided via URL
  const DEFAULT_COMPANY_SPONSOR = "TR8095918105";

  // Agency
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
  const prettyRole = (r) =>
    ({
      user: "Consumer",
      agency: "Agency",
      employee: "Employee",
      business: "Merchant",
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

  // Locations
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCityId, setSelectedCityId] = useState("");
  const [pincode, setPincode] = useState("");

  // Geo assist
  const [autoLoading, setAutoLoading] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [geoCountryName, setGeoCountryName] = useState("");
  const [geoStateName, setGeoStateName] = useState("");
  const [geoCityName, setGeoCityName] = useState("");
  const geoRequestedRef = useRef(false);

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

  const isAgency = role === "agency";
  const currentCategory = mapUIRoleToCategory();
  const isSC = currentCategory === "agency_state_coordinator";
  const isStateCat = currentCategory === "agency_state";
  const isDC = currentCategory === "agency_district_coordinator";
  const isDistrictCat = currentCategory === "agency_district";
  const isPC = currentCategory === "agency_pincode_coordinator";
  const isPincodeCat = currentCategory === "agency_pincode";
  const isSubFranchiseCat = currentCategory === "agency_sub_franchise";

  // Effects: lock role
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
      if (effectiveRole === "agency" && level) {
        setAgencyLevel(level);
      }
    } catch {}
  }, [location.search, lockedRole]); // eslint-disable-line

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
  }, []); // eslint-disable-line

  // If no sponsor is present in URL, default to company sponsor on mount
  useEffect(() => {
    if (!sponsorLocked && !String(sponsorId || "").trim()) {
      setSponsorId(DEFAULT_COMPANY_SPONSOR);
    }
    // run once on mount and if lock state toggles
    // eslint-disable-next-line
  }, [sponsorLocked]); // eslint-disable-line

  // Keep URL in sync with sponsor and agency_level
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || "");
      const nextParams = new URLSearchParams();
      const s = normalizeSponsor(sponsorId);
      if (s) nextParams.set("sponsor", s);
      if (role === "agency") {
        if (agencyLevel) nextParams.set("agency_level", agencyLevel);
      }
      const cur = params.toString();
      const nxt = nextParams.toString();
      if (cur !== nxt) {
        const qs = nxt ? `?${nxt}` : "";
        navigate(`/v2/register/${role}${qs}`, { replace: true });
      }
    } catch {}
    // eslint-disable-next-line
  }, [role, agencyLevel, sponsorId, location.pathname]);

  // Countries
  useEffect(() => {
    (async () => {
      try {
        const res = await API.get("/location/countries/");
        setCountries(res.data || []);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const loadStates = async (countryId) => {
    try {
      const res = await API.get("/location/states/", { params: { country: countryId } });
      setStates(res.data || []);
    } catch {
      setStates([]);
    }
  };
  const loadCities = async (stateId) => {
    try {
      const res = await API.get("/location/cities/", { params: { state: stateId } });
      setCities(res.data || []);
    } catch {
      setCities([]);
    }
  };

  // Lookup location by pincode and set geo names
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
    } catch (e) {
      // ignore errors
    }
  };

  const handlePincodeManualChange = (val) => {
    const next = String(val || "").replace(/\D/g, "").slice(0, 6);
    setPincode(next);
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
    if (value) loadStates(value);
  };
  const handleStateChange = (e) => {
    const value = e.target.value;
    setSelectedState(value);
    setSelectedCity("");
    setSelectedCityId("");
    setCities([]);
    setPincode("");
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
          if (detectedState) {
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
          }
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
        const pins = Array.from(
          new Set(
            (resp?.data?.pincodes || [])
              .map((p) => String(p || "").replace(/\D/g, "").slice(0, 6))
              .filter((p) => /^\d{6}$/.test(p))
          )
        );
        setNonAgencyDistrictPincodes(pins);
        setPincode((prev) => {
          const prevNorm = String(prev || "").replace(/\D/g, "").slice(0, 6);
          if (/^\d{6}$/.test(prevNorm) && pins.includes(prevNorm)) return prevNorm;
          return pins[0] || prevNorm || "";
        });
      } catch {
        setNonAgencyDistrictPincodes([]);
      } finally {
        setPinByDistrictLoadingNA(false);
      }
    })();
  }, [isAgency, selectedCity, selectedState]); // eslint-disable-line

  // Auto-map geo detected Country -> Country select (non-agency)
  useEffect(() => {
    if (isAgency) return;
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
  }, [isAgency, geoCountryName, countries, selectedCountry]); // eslint-disable-line

  // Auto-map geo detected State -> State select (non-agency)
  useEffect(() => {
    if (isAgency) return;
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
  }, [isAgency, selectedCountry, geoStateName, states, selectedState]); // eslint-disable-line

  // Auto-map geo detected District/City -> District select (non-agency)
  useEffect(() => {
    if (isAgency) return;
    if (!selectedState || selectedCity) return;
    const input = String(geoCityName || "");
    if (!input || !Array.isArray(cities) || !cities.length) return;
    const norm = (v) => String(v || "").trim().toLowerCase();
    const variants = (s) => {
      const b = norm(s);
      const map = {
        bengaluru: ["bangalore"],
        "bengaluru urban": ["bangalore urban"],
        "bengaluru rural": ["bangalore rural"],
        mysuru: ["mysore"],
        shivamogga: ["shimoga"],
        tumakuru: ["tumkur"],
        chikkamagaluru: ["chikmagalur"],
        belagavi: ["belgaum"],
        vijayapura: ["bijapur"],
        ballari: ["bellary"],
        kalaburagi: ["gulbarga", "kalaburgi"],
        kalaburgi: ["kalaburagi", "gulbarga"],
      };
      const set = new Set([b]);
      for (const [k, arr] of Object.entries(map)) {
        if (b === k || arr.includes(b)) {
          set.add(k);
          for (const x of arr) set.add(x);
        }
      }
      return Array.from(set);
    };
    const cityList = (cities || [])
      .map((c) => c?.name || c?.Name || c?.city || c?.City)
      .filter(Boolean);
    const nlist = cityList.map((n) => ({ raw: n, key: norm(n) }));
    const vset = new Set(variants(input));
    let chosen = null;
    for (const item of nlist) {
      if (vset.has(item.key)) {
        chosen = item.raw;
        break;
      }
    }
    if (!chosen) {
      const base = norm(input);
      chosen = nlist.find((it) => it.key.includes(base))?.raw || null;
    }
    if (chosen) {
      setSelectedCity(chosen);
      try {
        const m = (cities || []).find((c) => {
          const nm = String(c?.name || c?.Name || c?.city || c?.City || "").trim().toLowerCase();
          return nm === norm(chosen);
        });
        setSelectedCityId(m && m.id != null ? String(m.id) : "");
      } catch {}
    }
  }, [isAgency, selectedState, geoCityName, cities, selectedCity]); // eslint-disable-line

  // Auto-lookup pincode -> infer district/state/country (non-agency incl. business)
  useEffect(() => {
    if (isAgency) return;
    const code = String(pincode || "").trim();
    if (code.replace(/\D/g, "").length === 6) {
      const t = setTimeout(() => fetchFromBackendPin(code), 400);
      return () => clearTimeout(t);
    }
  }, [isAgency, pincode]); // eslint-disable-line

  // Sponsor live validation
  useEffect(() => {
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
          const r = await API.get("/accounts/regions/by-sponsor/", { params: { sponsor: s, level: "state" } });
          const sp = r?.data?.sponsor || {};
          name = sp.full_name || sp.username || "";
          pcode = sp.pincode || "";
          uname = sp.username || s;
          exists = Boolean(name || pcode || uname);
        } catch {
          try {
            const r2 = await API.get("/accounts/hierarchy/", { params: { username: s } });
            const u = r2?.data?.user || r2?.data || {};
            if (u?.username) {
              exists = true;
              uname = u.username;
              name = u.full_name || "";
              pcode = u.pincode || "";
            }
          } catch {}
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
  }, [sponsorId]); // eslint-disable-line

  // Agency: load all states (for State Coordinator)
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
        const states = resp?.data?.states || [];
        setSponsorStates(states);
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
        const districts = resp?.data?.districts || [];
        setSponsorDistricts(districts);
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
        const pins = Array.from(
          new Set(
            (resp?.data?.pincodes || [])
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
        const pins = Array.from(
          new Set(
            (resp?.data?.pincodes || [])
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

  const handleChange = (e) => setFormData((fd) => ({ ...fd, [e.target.name]: e.target.value }));

  const handleSetRole = (r) => {
    setRole(r);
    try {
      const params = new URLSearchParams(location.search || "");
      const s = normalizeSponsor(params.get("sponsor") || sponsorId);
      const parts = [];
      if (s) parts.push(`sponsor=${encodeURIComponent(s)}`);
      if (String(r).toLowerCase() === "agency") {
        const lvl = (agencyLevel || params.get("agency_level") || params.get("category") || "").toString();
        if (lvl) parts.push(`agency_level=${encodeURIComponent(lvl)}`);
      }
      const qs = parts.length ? `?${parts.join("&")}` : "";
      navigate(`/v2/register/${r}${qs}`, { replace: true });
    } catch {}
  };

  // Validation for agency inputs (unchanged)
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
    if (!AGENCY_CATEGORIES.has(category)) {
      if (!selectedCountry || !selectedState || !selectedCity || !pincode) {
        setErrorMsg("Please select Country, State, District and Pincode");
        return;
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
        city: cityId ?? (selectedCityId && /^\d+$/.test(String(selectedCityId)) ? Number(selectedCityId) : null),
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

    try {
      const submittedPassword = formData.password;
      if (category === "business") {
        const resp = await API.post("/accounts/register/", payload);
        const data = resp?.data || {};
        const uname = data.username || "(generated)";

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
              city: cityId ?? (selectedCityId && /^\d+$/.test(String(selectedCityId)) ? Number(selectedCityId) : null),
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
      // Reset fields (common)
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
      const msg =
        err?.response?.data ? JSON.stringify(err.response.data) : "Registration failed!";
      setErrorMsg(typeof msg === "string" ? msg : String(msg));
    }
  };

  // Reusable visual tokens
  const inputSx = {
    mb: 2,
    "& .MuiOutlinedInput-root": {
      height: 48,
      bgcolor: "#FFFFFF",
      borderRadius: 1.5,
      "& fieldset": { borderColor: "#E5E7EB" },
      "&:hover fieldset": { borderColor: "#D1D5DB" },
      "&.Mui-focused fieldset": { borderColor: "#FF7B00" },
      "&.Mui-focused": { boxShadow: "0 0 0 4px rgba(255, 123, 0, 0.12)" },
    },
    "& .MuiInputLabel-root": { color: "#6B7280" },
    "& input, & textarea": {
      color: "#1F2937",
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    },
  };
  const selectSx = {
    mb: 2,
    "& .MuiOutlinedInput-root": {
      height: 48,
      bgcolor: "#FFFFFF",
      borderRadius: 1.5,
      "& fieldset": { borderColor: "#E5E7EB" },
      "&:hover fieldset": { borderColor: "#D1D5DB" },
      "&.Mui-focused fieldset": { borderColor: "#FF7B00" },
      "&.Mui-focused": { boxShadow: "0 0 0 4px rgba(255, 123, 0, 0.12)" },
    },
    "& .MuiInputLabel-root": { color: "#6B7280" },
    "& .MuiSelect-select": {
      color: "#1F2937",
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      display: "flex",
      alignItems: "center",
    },
  };
  const sectionTitleSx = { fontSize: 13, fontWeight: 600, color: "#6B7280", mb: 1 };

  // Stepper config — UI only
  const STEPS = ["Basic Info", "Location", "Security"];

  function DotStepIcon(props) {
    const { active, completed, className } = props;
    return (
      <Box
        className={className}
        sx={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          bgcolor: completed ? "#FF7B00" : "#E5E7EB",
          border: active ? "2px solid #FF7B00" : "2px solid transparent",
          backgroundColor: active ? "#FFFFFF" : undefined,
          boxSizing: "border-box",
        }}
      />
    );
  }

  const OrangeConnector = styled(StepConnector)(({ theme }) => ({
    "& .MuiStepConnector-line": {
      borderColor: "#E5E7EB",
      borderTopWidth: 2,
      borderRadius: 1,
    },
    "&.Mui-active .MuiStepConnector-line": {
      borderColor: "#FF7B00",
    },
    "&.Mui-completed .MuiStepConnector-line": {
      borderColor: "#FF7B00",
    },
  }));

  // Step header component (Stepper + Section meta) — UI-only
  const StepHeader = ({ stepNum }) => {
    const active = Math.max(0, Math.min(2, Number(stepNum) - 1));
    const sectionTitle = active === 0 ? "Basic Info" : active === 1 ? "Location" : "Account Security";
    return (
      <Box sx={{ textAlign: "center", mb: 1 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.2, mt: 1 }}>
          Register
        </Typography>

        <Stepper
          alternativeLabel
          activeStep={active}
          connector={<OrangeConnector />}
          sx={{
            mt: 1,
            mb: 1,
            "& .MuiStepLabel-label": {
              typography: "caption",
              color: "#6B7280",
              display: { xs: "none", sm: "block" },
            },
          }}
        >
          {STEPS.map((label, idx) => (
            <Step key={label} disabled={idx > active}>
              <StepLabel StepIconComponent={DotStepIcon}>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Divider sx={{ mb: 1.5 }} />

        <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
          {sectionTitle}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 0.25 }}>
          {`Step ${stepNum} of 3`}
        </Typography>
      </Box>
    );
  };

  // Role selection header (Step 0)
  const RoleHeader = () => (
    <Box sx={{ textAlign: "center", mb: 1 }}>
      <Typography sx={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.2, mt: 1 }}>
        Choose how you want to use TRIKONEKT
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.5 }}>
        This helps us set up the right account for you
      </Typography>
    </Box>
  );

  // Step 0 — Role selection cards (UI only, no logic change)
  const Step0 = () => {
    const roles = [
      { key: "user", title: "Consumer", desc: "Shop, earn rewards, and enjoy benefits" },
      { key: "agency", title: "Agency", desc: "Build a network and earn commission income" },
      { key: "business", title: "Merchant", desc: "Promote, sell, and grow your business" },
      { key: "employee", title: "Employee", desc: "Marketing, training, and job opportunities" },
    ];
    const Card = ({ k, title, desc }) => {
      const selected = role === k;
      return (
        <Box
          role="button"
          tabIndex={0}
          onClick={() => { if (roleLockedUI) return; setRole(k); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (roleLockedUI) return;
              setRole(k);
            }
          }}
          sx={{
            p: 2,
            mb: 1.5,
            borderRadius: 2,
            border: `1px solid ${selected ? "#FF7B00" : "#E5E7EB"}`,
            bgcolor: selected ? "#FFF8EF" : "#FFFFFF",
            boxShadow: selected ? "0 0 0 4px rgba(255,123,0,0.12)" : "none",
            cursor: roleLockedUI ? "not-allowed" : "pointer",
            opacity: roleLockedUI ? 0.6 : 1,
          }}
        >
          <Typography sx={{ fontWeight: 700, color: "#111827" }}>{title}</Typography>
          <Typography sx={{ fontSize: 13, color: "#6B7280", mt: 0.5 }}>{desc}</Typography>
        </Box>
      );
    };
    return (
      <Box>
        {roles.map((r) => (
          <Card key={r.key} k={r.key} title={r.title} desc={r.desc} />
        ))}
        <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 0.5, mb: 1 }}>
          You can’t change this later
        </Typography>
        <Box
          sx={{
            "& .MuiButton-root": {
              backgroundColor: "#FF7B00",
              color: "#FFFFFF",
              height: 48,
              borderRadius: 1.5,
              fontWeight: 600,
              textTransform: "none",
            },
            "& .MuiButton-root:hover": { backgroundColor: "#E86F00" },
          }}
        >
          <V2Button
            type="button"
            fullWidth
            disabled={!role}
            onClick={() => {
              handleSetRole(role);
              setRoleLockedUI(true);
              setStep(1);
            }}
          >
            Continue
          </V2Button>
        </Box>
      </Box>
    );
  };

  // Step 1 — Register (Basic Info + Sponsor)
  const Step1 = () => (
    <Box>
      {/* Selected role info (read-only) */}
      <Typography sx={sectionTitleSx}>Account type</Typography>
      <Box sx={{ p: 2, mb: 2, borderRadius: 2, border: "1px solid #E5E7EB", bgcolor: "#F9FAFB" }}>
        <Typography sx={{ fontWeight: 700, color: "#111827" }}>
          Registering as: {prettyRole(role)}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 0.5 }}>
          Role selected based on your choice
        </Typography>
      </Box>

      {/* Sponsor */}
      <Typography sx={sectionTitleSx}>Sponsor</Typography>
      <TextField
        fullWidth
        label="Sponsor Username"
        value={sponsorId}
        onChange={(e) => setSponsorId(e.target.value)}
        required
        disabled={sponsorLocked}
        sx={inputSx}
        InputProps={{
          readOnly: sponsorLocked,
        }}
      />
      {/* Subtle inline messages (no big success card) */}
      {sponsorChecking && (
        <Typography variant="body2" sx={{ color: "#6B7280", mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={14} /> Validating sponsor…
        </Typography>
      )}
      {sponsorValid === true && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "#10B981", mb: 0.5 }}>
            <CheckCircleRoundedIcon sx={{ fontSize: 18 }} />
            <Typography variant="body2">Sponsor verified</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: "#6B7280", mb: 1, display: "block" }}>
            Your sponsor connects you to the TRIKONEKT network
          </Typography>
        </>
      )}
      {sponsorValid === false && (
        <Typography variant="body2" sx={{ color: "#EF4444", mb: 1 }}>
          Invalid Sponsor ID. Please correct the Sponsor ID.
        </Typography>
      )}

      {/* Basic Info */}
      <Typography sx={sectionTitleSx}>Basic Info</Typography>
      <TextField
        fullWidth
        label="Name"
        name="full_name"
        value={formData.full_name}
        onChange={handleChange}
        sx={inputSx}
        required
      />
      <TextField
        fullWidth
        label="Email"
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        sx={inputSx}
        required
      />
      <TextField
        fullWidth
        label="Phone Number"
        name="phone"
        value={formData.phone}
        onChange={handleChange}
        sx={inputSx}
        type="tel"
        inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
        required
      />

      {/* Business-only extra basic fields remain in Step 1 */}
      {role === "business" && (
        <>
          <TextField
            fullWidth
            label="Business Name"
            name="business_name"
            value={formData.business_name}
            onChange={handleChange}
            sx={inputSx}
            required
          />
          <FormControl fullWidth sx={selectSx}>
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
            label="Address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            sx={{ ...inputSx, "& .MuiOutlinedInput-root": { ...inputSx["& .MuiOutlinedInput-root"], height: "auto" } }}
            multiline
            minRows={2}
            required
          />
        </>
      )}

      {/* Agency — Registration Type is applicant info (keep in Step 1) */}
      {role === "agency" && (
        <>
          <Typography sx={{ ...sectionTitleSx, mt: 1 }}>Registration Type</Typography>
          <FormControl fullWidth sx={selectSx}>
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
        </>
      )}

      {/* Step 1 CTA */}
      <Box
        sx={{
          mt: 1,
            "& .MuiButton-root": {
              backgroundColor: "#FF7B00",
              color: "#FFFFFF",
              height: 48,
              borderRadius: 1.5,
              fontWeight: 600,
              textTransform: "none",
              boxShadow: "0 2px 6px rgba(255, 123, 0, 0.25)",
            },
            "& .MuiButton-root:hover": {
              backgroundColor: "#E86F00",
              boxShadow: "0 3px 8px rgba(255, 123, 0, 0.35)",
            },
        }}
      >
        <V2Button type="button" fullWidth onClick={() => setStep(2)}>
          Continue
        </V2Button>
      </Box>
    </Box>
  );

  // Step 2 — Location + Agency territory/assignment
  const Step2 = () => (
    <Box>
      <Typography sx={sectionTitleSx}>Location</Typography>

      {/* Non-agency & business location inputs (unchanged logic) */}
      {!isAgency && (
        <>
          {selectedCity && (nonAgencyDistrictPincodes || []).length > 0 ? (
            <FormControl fullWidth sx={selectSx}>
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
          ) : (
            <TextField
              fullWidth
              label="Pincode"
              value={pincode}
              onChange={(e) => handlePincodeManualChange(e.target.value)}
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
              helperText="Enter 6-digit pincode to auto-select District/State/Country"
              sx={inputSx}
              required
            />
          )}
          <FormControl fullWidth sx={selectSx}>
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
          <FormControl fullWidth sx={selectSx}>
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
          <FormControl fullWidth sx={selectSx}>
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
        </>
      )}

      {/* Agency territory & assignment (unchanged logic, just placed in Step 2) */}
      {isAgency && (
        <>
          {/* State Coordinator assignments */}
          {isSC && (
            <>
              <Typography sx={{ ...sectionTitleSx, mt: 1 }}>Assignment</Typography>
              <FormControl fullWidth sx={selectSx}>
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
              <FormControl fullWidth sx={selectSx}>
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

          {/* Sponsor Territory */}
          {(isStateCat || isDC || isDistrictCat || isPC || isPincodeCat) && (
            <>
              <Typography sx={{ ...sectionTitleSx, mt: 1 }}>Sponsor Territory</Typography>
              <FormControl fullWidth sx={selectSx}>
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
            </>
          )}

          {isDC && (
            <FormControl fullWidth sx={selectSx}>
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
            <FormControl fullWidth sx={selectSx}>
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
            <FormControl fullWidth sx={selectSx}>
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
            <FormControl fullWidth sx={selectSx}>
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

          {/* Sub Franchise territory selection */}
          {isSubFranchiseCat && (
            <>
              <Typography sx={{ ...sectionTitleSx, mt: 1 }}>Territory</Typography>
              <FormControl fullWidth sx={selectSx}>
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

              <FormControl fullWidth sx={selectSx}>
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

              <FormControl fullWidth sx={selectSx}>
                <InputLabel>City/District</InputLabel>
                <Select
                  label="City/District"
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

              <FormControl fullWidth sx={selectSx}>
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
        </>
      )}

      {/* Step 2 Nav */}
      <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
        <V2Button type="button" variant="secondary" onClick={() => setStep(1)} sx={{ flex: 1 }}>
          Back
        </V2Button>
        <Box
          sx={{
            flex: 1,
            "& .MuiButton-root": {
              backgroundColor: "#FF7B00",
              color: "#FFFFFF",
              height: 48,
              borderRadius: 1.5,
              fontWeight: 600,
              textTransform: "none",
              boxShadow: "0 2px 6px rgba(255, 123, 0, 0.25)",
            },
            "& .MuiButton-root:hover": {
              backgroundColor: "#E86F00",
              boxShadow: "0 3px 8px rgba(255, 123, 0, 0.35)",
            },
          }}
        >
          <V2Button type="button" fullWidth onClick={() => setStep(3)}>
            Continue
          </V2Button>
        </Box>
      </Box>
    </Box>
  );

  // Step 3 — Account Security + Submit
  const Step3 = () => (
    <Box>
      <Typography sx={sectionTitleSx}>Account Security</Typography>
      <TextField
        fullWidth
        name="password"
        value={formData.password}
        label="Password"
        type={showPassword ? "text" : "password"}
        onChange={handleChange}
        sx={inputSx}
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
        sx={inputSx}
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

      {/* Step 3 Nav */}
      <Box sx={{ mt: 1, display: "flex", gap: 1, mb: 1 }}>
        <V2Button type="button" variant="secondary" onClick={() => setStep(2)} sx={{ flex: 1 }}>
          Back
        </V2Button>
        <Box
          sx={{
            flex: 1,
            "& .MuiButton-root": {
              backgroundColor: "#FF7B00",
              color: "#FFFFFF",
              height: 48,
              borderRadius: 1.5,
              fontWeight: 600,
              textTransform: "none",
              boxShadow: "0 2px 6px rgba(255, 123, 0, 0.25)",
            },
            "& .MuiButton-root:hover": {
              backgroundColor: "#E86F00",
              boxShadow: "0 3px 8px rgba(255, 123, 0, 0.35)",
            },
          }}
        >
          <V2Button fullWidth type="submit">
            Sign Up
          </V2Button>
        </Box>
      </Box>

      <Typography variant="body2" align="center" sx={{ color: "#6B7280" }}>
        Already have an account?{" "}
        <Link
          onClick={() => navigate(`/v2/login/${role}`)}
          sx={{ fontWeight: 700, cursor: "pointer", color: "#FF7B00", textDecoration: "none" }}
        >
          Login
        </Link>
      </Typography>
    </Box>
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#FFFFFF",
        px: 2,
        py: 4,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            maxWidth: 520,
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: 2,
            position: "relative",
            bgcolor: "#FFFFFF",
            border: "1px solid #F3F4F6",
            boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          }}
        >
          {/* Accent strip */}
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              bgcolor: "#FFF4DF",
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
            }}
          />


          {/* Header */}
          {step === 0 ? <RoleHeader /> : <StepHeader stepNum={step} />}

          {/* Alerts (logic unchanged) */}
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

          {/* Form wrapper — only Step 3 submit triggers handleSubmit */}
          <Box component="form" noValidate onSubmit={handleSubmit}>
            {step === 0 && <Step0 />}
            {step === 1 && <Step1 />}
            {step === 2 && <Step2 />}
            {step === 3 && <Step3 />}
          </Box>

          {/* Registration success popup (unchanged) */}
          <Dialog open={regSuccessOpen} onClose={() => setRegSuccessOpen(false)} fullWidth maxWidth="xs">
            <DialogTitle>Registration Successful</DialogTitle>
            <DialogContent>
              <Typography variant="body1" sx={{ whiteSpace: "pre-line" }}>
                {`Welcome to Trikonekt!\n\nUsername: ${regSuccessText.username}\nPassword: ${regSuccessText.password}`}
              </Typography>
            </DialogContent>
            <DialogActions>
              <V2Button variant="secondary" onClick={() => setRegSuccessOpen(false)}>Close</V2Button>
              <V2Button
                onClick={() => {
                  setRegSuccessOpen(false);
                  navigate(`/v2/login/${role}`, { replace: true });
                }}
              >
                Go to Login
              </V2Button>
            </DialogActions>
          </Dialog>

          
        </Paper>
      </Container>
    </Box>
  );
};

export default RegisterV2;
