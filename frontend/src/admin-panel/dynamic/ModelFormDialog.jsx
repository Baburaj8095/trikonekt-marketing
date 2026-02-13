import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  Typography,
} from "@mui/material";
import API from "../../api/api";

/**
 * Generic Create/Edit dialog based on field metadata from /api/admin/admin-meta/.
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - route: string (e.g., "/admin/dynamic/accounts/customuser/")
 * - fields: Array<{ name, type, read_only, required, label, choices? }>
 * - record: object | null (if present, edit mode; else create)
 * - onSaved: () => void (invoked after successful save)
 * - title?: string
 */
export default function ModelFormDialog({
  open,
  onClose,
  route,
  fields = [],
  record = null,
  onSaved,
  title,
}) {
  const [values, setValues] = React.useState({});
  const [errors, setErrors] = React.useState({});
  const [formError, setFormError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [formFields, setFormFields] = React.useState([]);
  const [formLoading, setFormLoading] = React.useState(false);

  // Admin Users route detection + specialized geo editor state
  const isAdminUsersRoute = React.useMemo(() => {
    try {
      const p = String(route || "");
      return /\/admin\/users\/?$/i.test(p);
    } catch {
      return false;
    }
  }, [route]);

  // Normalize route to API namespace so requests hit the backend via proxy.
  // This keeps compatibility with callers that pass "/admin/users/".
  const routeNormalized = React.useMemo(() => {
    try {
      const r = String(route || "");
      if (/^\/?admin\/users\/?$/i.test(r)) return "/api/admin/users/";
      if (/^\/?admin\/users\//i.test(r)) return r.replace(/^\/?admin\/users\//i, "/api/admin/users/");
      return r;
    } catch {
      return route;
    }
  }, [route]);

  // State Coordinator: only State editable (no district/pincode)
  const isSC = React.useMemo(() => {
    const cat = String(record?.category || "").toLowerCase();
    return cat === "agency_state_coordinator";
  }, [record]);
  // Additional agency category flags for specialized admin editing
  const category = React.useMemo(() => String(record?.category || "").toLowerCase(), [record]);
  const isDC = React.useMemo(() => category === "agency_district_coordinator", [category]);
  const isPC = React.useMemo(() => category === "agency_pincode_coordinator", [category]);
  const isStateCat = React.useMemo(() => category === "agency_state", [category]);
  const isDistrictCat = React.useMemo(() => category === "agency_district", [category]);
  const isPincodeCat = React.useMemo(() => category === "agency_pincode", [category]);
  const isSubFranchiseCat = React.useMemo(() => category === "agency_sub_franchise", [category]);

  // Geo state for Admin Users editor
  const [geoStates, setGeoStates] = React.useState([]);
  const [geoCities, setGeoCities] = React.useState([]);
  const [stateIdSel, setStateIdSel] = React.useState("");
  const [cityIdSel, setCityIdSel] = React.useState("");
  const [pin6, setPin6] = React.useState("");
  // Coordinator multi-assignments and sponsor-scoped options
  const [assignStates, setAssignStates] = React.useState([]);
  const [assignDistricts, setAssignDistricts] = React.useState([]);
  const [assignPincodes, setAssignPincodes] = React.useState([]);
  const [sponsorStates, setSponsorStates] = React.useState([]);
  const [sponsorDistricts, setSponsorDistricts] = React.useState([]);
  const [sponsorPincodes, setSponsorPincodes] = React.useState([]);
  const [districtPincodes, setDistrictPincodes] = React.useState([]);

  // Resolve fields dynamically:
  // 1) Prefer backend OPTIONS schema (POST for create, PATCH/POST for edit)
  // 2) Fallback to provided props.fields
  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setFormLoading(true);
        const base = Array.isArray(fields) ? fields : [];
        const targetUrl = record && (record.id || record.pk) ? `${routeNormalized}${record.id || record.pk}/` : routeNormalized;
        let derived = [];
        try {
          const res = await API.options(targetUrl);
          const actions = res?.data?.actions || {};
          const actionSchema = record
            ? (actions.PATCH || actions.POST || actions.PUT || null)
            : (actions.POST || actions.PUT || actions.PATCH || null);
          if (actionSchema && typeof actionSchema === "object") {
            derived = Object.entries(actionSchema).map(([name, meta]) => {
              const t = String(meta?.type || "").toLowerCase();
              const choices = Array.isArray(meta?.choices)
                ? meta.choices.map((c) => [c.value, c.display_name || c.display || String(c.value)])
                : undefined;
              return {
                name,
                type: meta?.type || "",
                required: !!meta?.required,
                read_only: !!meta?.read_only,
                label: meta?.label || name,
                choices,
                widget: t.includes("file") ? "file" : undefined,
                help_text: meta?.help_text || "",
                default: meta?.default,
              };
            });
          }
        } catch {
          // ignore OPTIONS errors, fallback to provided fields
        }
        let finalFields = (derived && derived.length) ? derived : base;
        if (isAdminUsersRoute) {
          const allowed = new Set(["email", "full_name", "phone", "sponsor_id", "pincode", "state", "city", "account_active"]);
          const cat = String(record?.category || "").toLowerCase();
          if (cat === "agency_state_coordinator") {
            allowed.delete("city");
            allowed.delete("pincode");
          }
          finalFields = (finalFields || []).filter((f) => f && allowed.has(String(f.name || "")));
          // Do not render username in Admin Users editor; it will be auto-synced to phone when phone changes.
        }
        if (mounted) setFormFields(finalFields);
      } finally {
        if (mounted) setFormLoading(false);
      }
    }
    if (open && route) load();
    else setFormFields(Array.isArray(fields) ? fields : []);
    return () => { mounted = false; };
  }, [open, route, record, fields]);

  // Initialize values whenever record or resolved form fields change
  React.useEffect(() => {
    const init = {};
    for (const f of formFields) {
      if (record && record[f.name] !== undefined) {
        init[f.name] = record[f.name];
      } else if (f.default !== undefined) {
        init[f.name] = f.default;
      } else {
        init[f.name] = f.required ? "" : "";
      }
    }
    setValues(init);
    setErrors({});
}, [record, formFields, open]);

  // Initialize coordinator assignment arrays from record (prefer read-only *_assigned from API)
  React.useEffect(() => {
    if (!open || !isAdminUsersRoute) return;
    try {
      const as = Array.isArray(record?.states_assigned)
        ? record.states_assigned.map((s) => String((s && (s.id ?? s)))).filter(Boolean)
        : (Array.isArray(record?.assign_states) ? record.assign_states.map((x) => String(x)) : []);
      const ad = Array.isArray(record?.districts_assigned)
        ? record.districts_assigned.map((x) => String(x))
        : (Array.isArray(record?.assign_districts) ? record.assign_districts.map((x) => String(x)) : []);
      const ap = Array.isArray(record?.pincodes_assigned)
        ? record.pincodes_assigned.map((x) => String(x))
        : (Array.isArray(record?.assign_pincodes) ? record.assign_pincodes.map((x) => String(x)) : []);
      setAssignStates(as);
      setAssignDistricts(ad);
      setAssignPincodes(ap);
    } catch {
      setAssignStates([]);
      setAssignDistricts([]);
      setAssignPincodes([]);
    }
  }, [open, isAdminUsersRoute, record]);

  // Fallback prefill for multi-assign selections when backend doesn't return assign_* fields
  React.useEffect(() => {
    if (!open || !isAdminUsersRoute) return;
    try {
      const preferArray = (...cands) => {
        for (const c of cands) if (Array.isArray(c) && c.length) return c;
        return [];
      };

      // Robust candidates from common server payload shapes
      const candStates = preferArray(
        record?.assign_states,
        record?.selected_states,
        record?.states,
        record?.assigned_states,
        record?.regions?.states,
        record?.data?.assign_states
      );
      const candDistricts = preferArray(
        record?.assign_districts,
        record?.selected_districts,
        record?.districts,
        record?.assigned_districts,
        record?.regions?.districts,
        record?.data?.assign_districts
      );
      const candPincodes = preferArray(
        record?.assign_pincodes,
        record?.selected_pincodes,
        record?.pincodes,
        record?.pincode_list,
        record?.assigned_pincodes,
        record?.regions?.pincodes,
        record?.data?.assign_pincodes
      );

      // State Coordinator: prefer array candidates; fallback to single selected_state/state
      if (isSC && (!Array.isArray(assignStates) || assignStates.length === 0)) {
        if (candStates.length) {
          setAssignStates(candStates.map((x) => String(x)));
        } else {
          const sid = record?.selected_state ?? record?.state ?? record?.state_id;
          if (sid != null && sid !== "") setAssignStates([String(sid)]);
        }
      }

      // District Coordinator: prefer array candidates; fallback to selected_district/district_name/city_name
      if (isDC && (!Array.isArray(assignDistricts) || assignDistricts.length === 0)) {
        if (candDistricts.length) {
          setAssignDistricts(candDistricts.map((x) => String(x)));
        } else {
          const d = record?.selected_district || record?.district_name || record?.city_name;
          if (d) setAssignDistricts([String(d)]);
        }
      }

      // Pincode Coordinator: prefer array candidates; fallback to single selected_pincode/pincode
      if (isPC && (!Array.isArray(assignPincodes) || assignPincodes.length === 0)) {
        if (candPincodes.length) {
          const pins = candPincodes
            .map((p) => String(p || "").replace(/\D/g, "").slice(0, 6))
            .filter((p) => /^\d{6}$/.test(p));
          if (pins.length) setAssignPincodes(pins);
        } else {
          const p = String(record?.selected_pincode || record?.pincode || "").replace(/\D/g, "").slice(0, 6);
          if (p && /^\d{6}$/.test(p)) setAssignPincodes([p]);
        }
      }
    } catch (_) {}
  }, [open, isAdminUsersRoute, isSC, isDC, isPC, record, assignStates, assignDistricts, assignPincodes]);

  const handleChange = (name, v) => {
    setValues((s) => ({ ...s, [name]: v }));
  };

  const isChoiceField = (f) => Array.isArray(f.choices) && f.choices.length > 0;
  const isBooleanField = (f) => {
    const t = String(f.type || "").toLowerCase();
    return (
      ["booleanfield", "nullbooleanfield"].includes(t) ||
      t === "boolean" || t === "bool" ||
      typeof values[f.name] === "boolean"
    );
  };
  const isNumeric = (f) => {
    const t = String(f.type || "").toLowerCase();
    return (
      ["integerfield", "bigintegerfield", "floatfield", "decimalfield", "autofield", "smallintegerfield"].includes(t) ||
      t === "integer" || t === "number" || t === "float" || t === "decimal"
    );
  };
  const isFileField = (f) => {
    if (!f) return false;
    const t = String(f.type || "").toLowerCase();
    const w = String(f.widget || "").toLowerCase();
    return (
      ["imagefield", "filefield"].includes(t) ||
      t.includes("file") || t.includes("image") ||
      w === "file" || w.includes("file")
    );
  };

  // Detect FK (PrimaryKeyRelatedField) via configured lookups for this route/field
  const routeKey = React.useMemo(() => {
    try {
      const m = String(route || "").match(/admin\/dynamic\/([^/]+)\/([^/]+)\//);
      return m ? `${m[1]}/${m[2]}` : "";
    } catch {
      return "";
    }
  }, [route]);

  // Known FK lookups to render searchable dropdowns instead of raw text
  const FK_LOOKUPS = React.useMemo(
    () => ({
      "business/promomonthlypackage": {
        package: { route: "admin/dynamic/business/promopackage/", labelField: "name", valueField: "id" },
      },
      "business/promopackageproduct": {
        package: { route: "admin/dynamic/business/promopackage/", labelField: "name", valueField: "id" },
        product: { route: "admin/dynamic/market/product/", labelField: "name", valueField: "id" },
      },
    }),
    []
  );

  const getLookupConfig = (fieldName) =>
    (FK_LOOKUPS?.[routeKey] && FK_LOOKUPS[routeKey][fieldName]) ? FK_LOOKUPS[routeKey][fieldName] : null;

  const isRelationField = (f) => {
    const t = String(f.type || "");
    return t === "PrimaryKeyRelatedField" || !!getLookupConfig(f.name);
  };

  // Remote options state (per-FK field)
  const [remoteOptions, setRemoteOptions] = React.useState({});
  const [remoteLoading, setRemoteLoading] = React.useState({});

  const fetchRemoteOptions = React.useCallback(async (fieldName, query = "") => {
    const conf = getLookupConfig(fieldName);
    if (!conf || !conf.route) return;
    setRemoteLoading((s) => ({ ...s, [fieldName]: true }));
    try {
      const params = { page: 1, page_size: 50 };
      if (query && String(query).trim()) params.search = String(query).trim();
      const { data } = await API.get(conf.route, { params });
      const results = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
      const mapped = results.map((r) => {
        const val = r?.[conf.valueField];
        const label = r?.[conf.labelField] || r?.code || r?.repr || r?.__str__ || String(val);
        return { value: val, label };
      });
      setRemoteOptions((s) => ({ ...s, [fieldName]: mapped }));
    } catch {
      setRemoteOptions((s) => ({ ...s, [fieldName]: [] }));
    } finally {
      setRemoteLoading((s) => ({ ...s, [fieldName]: false }));
    }
  }, [getLookupConfig]);

  function inputType(f) {
    const t = String(f.type || "").toLowerCase();
    if (t.includes("password")) return "password";
    if (t.includes("email")) return "email";
    if (t.includes("url")) return "url";
    if (t.includes("date") && t.includes("time")) return "datetime-local";
    if (t.includes("datetime")) return "datetime-local";
    if (t.includes("date")) return "date";
    if (isNumeric(f)) return "number";
    return "text";
  }

  function isMultiline(f) {
    const t = String(f.type || "").toLowerCase();
    return t.includes("text") || t.includes("json");
  }

  // Helpers to coerce relation values to PK integers when possible
  const coerceRelationValue = (f, v) => {
    if (v === "" || v === null || v === undefined) return v;
    if (typeof v === "object" && v) {
      const id = v.id ?? v.value ?? v.pk;
      if (id !== undefined && id !== null) return id;
    }
    const s = String(v);
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    return v;
  };

  // Load states/cities and map initial values for Admin Users editor
  React.useEffect(() => {
    if (!open || !isAdminUsersRoute) return;
    let cancelled = false;
    (async () => {
      try {
        // Load states (optionally paginated)
        const res = await API.get("/location/states/", { params: { page: 1, page_size: 500 } });
        const arr = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        if (cancelled) return;
        setGeoStates(arr);

        // Initial state selection (prefer id, fallback by name or selected_state)
        const rid = record?.state ?? record?.state_id;
        const rname = record?.state_name;
        let sid = rid ? String(rid) : "";
        if (!sid && rname) {
          const m = arr.find((s) => String(s?.name || "").trim().toLowerCase() === String(rname).trim().toLowerCase());
          if (m) sid = String(m.id);
        }
        if (!sid && record?.selected_state) {
          sid = String(record.selected_state);
        }
        setStateIdSel(sid);

        // Initial pincode (fallback to selected_pincode for agency edits)
        const pin = String(record?.pincode || record?.selected_pincode || "");
        setPin6(pin);

        // Load cities for selected state
        if (sid) {
          const r2 = await API.get("/location/cities/", { params: { state: sid, page: 1, page_size: 500 } });
          const arr2 = Array.isArray(r2?.data) ? r2.data : (r2?.data?.results || []);
          if (!cancelled) setGeoCities(arr2);

          const rcid = record?.city ?? record?.city_id;
          const rcn = record?.district_name ?? record?.city_name;
          let cid = rcid ? String(rcid) : "";
          if (!cid && rcn) {
            const m2 = arr2.find((c) => String(c?.name || c?.Name || c?.city || c?.City || "").trim().toLowerCase() === String(rcn).trim().toLowerCase());
            if (m2) cid = String(m2.id);
          }
          if (!cid && record?.selected_district) {
            const sd = String(record.selected_district).trim().toLowerCase();
            const m3 = arr2.find((c) => String(c?.name || c?.Name || c?.city || c?.City || "").trim().toLowerCase() === sd);
            if (m3) cid = String(m3.id);
          }
          if (!cancelled) setCityIdSel(cid);
        } else {
          setGeoCities([]);
          setCityIdSel("");
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [open, isAdminUsersRoute, record]);

  // When state changes (Admin Users), load cities list
  React.useEffect(() => {
    if (!open || !isAdminUsersRoute) return;
    if (!stateIdSel) { setGeoCities([]); setCityIdSel(""); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await API.get("/location/cities/", { params: { state: stateIdSel, page: 1, page_size: 500 } });
        const arr = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
        if (!cancelled) setGeoCities(arr);
      } catch {
        if (!cancelled) setGeoCities([]);
      }
    })();
    return () => { cancelled = true; };
}, [open, isAdminUsersRoute, stateIdSel]);

  // If districts are prefilled from assignDistricts (or PC needs district), map first match to cityIdSel when cities load
  React.useEffect(() => {
    if (!open || !isAdminUsersRoute) return;
    if (!(isDC || isPC)) return;
    if (!stateIdSel || !Array.isArray(geoCities) || !geoCities.length) return;
    if (cityIdSel) return;
    const name = Array.isArray(assignDistricts) && assignDistricts.length ? String(assignDistricts[0]) : "";
    if (!name) return;
    const norm = (s) => String(s || "").trim().toLowerCase();
    const m = (geoCities || []).find(
      (c) => norm(c?.name || c?.Name || c?.city || c?.City) === norm(name)
    );
    if (m) setCityIdSel(String(m.id));
  }, [open, isAdminUsersRoute, isDC, isPC, stateIdSel, geoCities, assignDistricts, cityIdSel]);

  // Sponsor-scoped states
  React.useEffect(() => {
    if (!open || !isAdminUsersRoute) return;
    const s = String(record?.sponsor_id || "").trim();
    if (!s) { setSponsorStates([]); return; }
    (async () => {
      try {
        const r = await API.get("/accounts/regions/by-sponsor/", { params: { sponsor: s, level: "state" } });
        const rows = Array.isArray(r?.data?.states) ? r.data.states : (Array.isArray(r?.data?.results) ? r.data.results : []);
        setSponsorStates(rows || []);
      } catch {
        setSponsorStates([]);
      }
    })();
  }, [open, isAdminUsersRoute, record?.sponsor_id]);

  // Sponsor-scoped districts for selected state
  React.useEffect(() => {
    if (!open || !isAdminUsersRoute || !stateIdSel) { setSponsorDistricts([]); return; }
    const s = String(record?.sponsor_id || "").trim();
    if (!s) { setSponsorDistricts([]); return; }
    (async () => {
      try {
        const r = await API.get("/accounts/regions/by-sponsor/", { params: { sponsor: s, level: "district", state_id: stateIdSel } });
        const rows = Array.isArray(r?.data?.districts) ? r.data.districts : (Array.isArray(r?.data?.results) ? r.data.results : []);
        setSponsorDistricts(rows || []);
      } catch {
        setSponsorDistricts([]);
      }
    })();
  }, [open, isAdminUsersRoute, record?.sponsor_id, stateIdSel]);

  // Sponsor-scoped pincodes (global list under sponsor)
  React.useEffect(() => {
    if (!open || !isAdminUsersRoute) return;
    const s = String(record?.sponsor_id || "").trim();
    if (!s) { setSponsorPincodes([]); return; }
    (async () => {
      try {
        const r = await API.get("/accounts/regions/by-sponsor/", { params: { sponsor: s, level: "pincode" } });
        const rows = Array.isArray(r?.data?.pincodes) ? r.data.pincodes : (Array.isArray(r?.data?.results) ? r.data.results : []);
        const pins = Array.from(new Set((rows || []).map((p) => String(p || "").replace(/\D/g, "").slice(0, 6)).filter((p) => /^\d{6}$/.test(p))));
        setSponsorPincodes(pins);
      } catch {
        setSponsorPincodes([]);
      }
    })();
  }, [open, isAdminUsersRoute, record?.sponsor_id]);

  // District-based pincodes for currently selected city/state
  React.useEffect(() => {
    if (!open || !isAdminUsersRoute || !stateIdSel) { setDistrictPincodes([]); return; }
    const item = (geoCities || []).find((c) => String(c?.id) === String(cityIdSel));
    const dname = item?.name || item?.Name || item?.city || item?.City || "";
    if (!dname) { setDistrictPincodes([]); return; }
    (async () => {
      try {
        const resp = await API.get("/location/pincodes/by-district/", { params: { district_name: dname, state_id: stateIdSel } });
        const rows = Array.isArray(resp?.data) ? resp.data : (resp?.data?.results || resp?.data?.pincodes || []);
        const pins = Array.from(new Set((rows || []).map((p) => String(p || "").replace(/\D/g, "").slice(0, 6)).filter((p) => /^\d{6}$/.test(p))));
        setDistrictPincodes(pins);
        setAssignPincodes((prev) => (Array.isArray(prev) ? prev.filter((p) => pins.includes(p)) : []));
      } catch {
        setDistrictPincodes([]);
      }
    })();
  }, [open, isAdminUsersRoute, stateIdSel, cityIdSel, geoCities]);

  // Derived options for coordinator editors
  const districtOptionsAdmin = React.useMemo(() => {
    const fromSponsor = (sponsorDistricts || [])
      .filter((d) => String(d?.state_id) === String(stateIdSel))
      .map((d) => d?.district)
      .filter(Boolean);
    if (fromSponsor.length) return Array.from(new Set(fromSponsor));
    const fromCities = (geoCities || [])
      .map((c) => c?.name || c?.Name || c?.city || c?.City)
      .filter(Boolean);
    return Array.from(new Set(fromCities));
  }, [sponsorDistricts, stateIdSel, geoCities]);

  const pincodeOptionsAdmin = React.useMemo(() => {
    const hasDistrict = Array.isArray(districtPincodes) && districtPincodes.length > 0;
    const hasSponsor = Array.isArray(sponsorPincodes) && sponsorPincodes.length > 0;
    if (hasDistrict && hasSponsor) {
      const ss = new Set(sponsorPincodes);
      return districtPincodes.filter((p) => ss.has(p));
    }
    return hasDistrict ? districtPincodes : sponsorPincodes;
  }, [districtPincodes, sponsorPincodes]);

  // Pincode -> auto-map state/district when possible (Admin Users)
  React.useEffect(() => {
    if (!open || !isAdminUsersRoute) return;
    const p = String(pin6 || "").replace(/\D/g, "");
    if (p.length !== 6) return;
    const t = setTimeout(async () => {
      try {
        const resp = await API.get(`/location/pincode/${p}/`);
        const data = resp?.data || {};
        const stName = data.state || "";
        const ctName = data.city || data.district || "";
        if (stName) {
          let sid = stateIdSel;
          if (!sid) {
            const s = (geoStates || []).find((x) => String(x?.name || "").trim().toLowerCase() === String(stName).trim().toLowerCase());
            if (s) sid = String(s.id);
          }
          if (sid) {
            setStateIdSel(sid);
            try {
              const r = await API.get("/location/cities/", { params: { state: sid, page: 1, page_size: 500 } });
              const arr = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
              setGeoCities(arr);
              if (ctName) {
                const m = arr.find((c) => String(c?.name || c?.Name || c?.city || c?.City || "").trim().toLowerCase() === String(ctName).trim().toLowerCase());
                if (m) setCityIdSel(String(m.id));
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(t);
  }, [open, isAdminUsersRoute, pin6, geoStates, stateIdSel]);

  // Sync selected geo into payload values so diff detection picks them up
  React.useEffect(() => {
    if (!isAdminUsersRoute) return;
    setValues((prev) => ({ ...prev, state: stateIdSel ? parseInt(stateIdSel, 10) : "" }));
  }, [isAdminUsersRoute, stateIdSel]);
  React.useEffect(() => {
    if (!isAdminUsersRoute || isSC) return;
    setValues((prev) => ({ ...prev, city: cityIdSel ? parseInt(cityIdSel, 10) : "" }));
  }, [isAdminUsersRoute, isSC, cityIdSel]);
  React.useEffect(() => {
    if (!isAdminUsersRoute || isSC) return;
    setValues((prev) => ({ ...prev, pincode: pin6 || "" }));
  }, [isAdminUsersRoute, isSC, pin6]);

  async function submit() {
    setSaving(true);
    setErrors({});
    setFormError("");
    try {
      const isEdit = record && (record.id || record.pk);
      const original = record || {};

      // Compute changed keys only (send diff on PATCH)
      const changed = [];
      for (const f of formFields) {
        if (f.read_only) continue;
        const name = f.name;
        let v = values[name];

        // Preserve existing behavior: on edit, omit empty -> do not change
        if (isEdit && (v === "" || v === null || v === undefined)) {
          continue;
        }

        let left = v;
        let right = original[name];

        // For files: treat as changed only if a new File is selected
        if (isFileField(f)) {
          if (left instanceof File) {
            changed.push(name);
          }
          continue;
        }

        // Normalize numeric for comparison
        if (isNumeric(f) && left !== "" && left !== null && left !== undefined) {
          if (f.type === "FloatField" || f.type === "DecimalField") {
            const n = Number(left);
            if (!Number.isNaN(n)) left = n;
          } else {
            const n = parseInt(left, 10);
            if (!Number.isNaN(n)) left = n;
          }
        }

        // Normalize relations for comparison
        if (isRelationField(f)) {
          left = coerceRelationValue(f, left);
          right = coerceRelationValue(f, right);
        }

        const same = (a, b) => {
          if (typeof a === "boolean" || typeof b === "boolean") return Boolean(a) === Boolean(b);
          if (a === undefined && b === undefined) return true;
          return String(a ?? "") === String(b ?? "");
        };

        if (!same(left, right)) {
          changed.push(name);
        }
      }

      // Admin Users whitelist and geo merge (+ multi-assign support for coordinators)
      if (isAdminUsersRoute) {
        const origState = original?.state ?? original?.state_id ?? "";
        const origCity = original?.city ?? original?.city_id ?? "";
        const origPin = original?.pincode ?? "";
        if (stateIdSel && String(stateIdSel) !== String(origState) && !changed.includes("state")) changed.push("state");
        if (!isSC && cityIdSel && String(cityIdSel) !== String(origCity) && !changed.includes("city")) changed.push("city");
        if (!isSC && typeof pin6 === "string" && String(pin6) !== String(origPin) && !changed.includes("pincode")) changed.push("pincode");

        // Multi-assign diffs
        const arrEq = (a, b) => {
          const A = Array.isArray(a) ? a.map(String).sort() : [];
          const B = Array.isArray(b) ? b.map(String).sort() : [];
          return A.length === B.length && A.every((v, i) => v === B[i]);
        };
        const origAssignStates = Array.isArray(original?.states_assigned)
          ? original.states_assigned.map((s) => String((s && (s.id ?? s)))).filter(Boolean)
          : (Array.isArray(original?.assign_states) ? original.assign_states.map(String) : []);
        const origAssignDistricts = Array.isArray(original?.districts_assigned)
          ? original.districts_assigned.map(String)
          : (Array.isArray(original?.assign_districts) ? original.assign_districts.map(String) : []);
        const origAssignPincodes = Array.isArray(original?.pincodes_assigned)
          ? original.pincodes_assigned.map(String)
          : (Array.isArray(original?.assign_pincodes) ? original.assign_pincodes.map(String) : []);
        if (isSC && !arrEq(origAssignStates, assignStates) && !changed.includes("assign_states")) changed.push("assign_states");
        if (isDC && !arrEq(origAssignDistricts, assignDistricts) && !changed.includes("assign_districts")) changed.push("assign_districts");
        if (isPC && !arrEq(origAssignPincodes, assignPincodes) && !changed.includes("assign_pincodes")) changed.push("assign_pincodes");

        // Whitelist
        const whitelist = [
          "full_name", "email", "phone", "sponsor_id", "username",
          "state", "city", "pincode", "account_active",
          ...(isSC ? ["assign_states"] : []),
          ...(isDC ? ["assign_districts"] : []),
          ...(isPC ? ["assign_pincodes"] : []),
        ];
        for (let i = changed.length - 1; i >= 0; i--) {
          if (!whitelist.includes(changed[i])) changed.splice(i, 1);
        }
      }

      // If nothing changed: for Admin Users, still issue a no-op PATCH to ensure request is visible
      // in Network tab and to refresh server-computed fields; otherwise just close.
      if (!changed.length) {
        if (isAdminUsersRoute && record && (record.id || record.pk)) {
          const url = `${routeNormalized}${record.id || record.pk}/`;
          try {
            await API.patch(url, {});
            try { onSaved && onSaved(); } catch (_) {}
          } catch (_) {
            // ignore; still close dialog
          }
        }
        onClose && onClose();
        return;
      }

      // Sync username with phone when phone changed (edit mode)
      let newUsernameForSync = null;
      if (isEdit && changed.includes("phone")) {
        const t = String(values.phone ?? "").trim();
        if (t) {
          newUsernameForSync = t;
          if (!changed.includes("username")) changed.push("username");
        }
      }

      // If any changed field is a file, use FormData; else JSON
      const wantsForm = changed.some((name) => {
        const f = formFields.find((x) => x.name === name) || {};
        return isFileField(f) || (values[name] instanceof File);
      });

      let dataToSend = null;

      if (wantsForm) {
        const form = new FormData();
        for (const name of changed) {
          const f = formFields.find((x) => x.name === name) || {};
          let v = (name === "username" && newUsernameForSync) ? newUsernameForSync : values[name];

          if (isAdminUsersRoute) {
            if (name === "state") v = stateIdSel ? parseInt(stateIdSel, 10) : "";
            if (!isSC && name === "city") v = cityIdSel ? parseInt(cityIdSel, 10) : "";
            if (!isSC && name === "pincode") v = pin6 || "";
            if (name === "assign_states") {
              v = (assignStates || []).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
            }
            if (name === "assign_districts") {
              v = Array.isArray(assignDistricts) ? assignDistricts : [];
            }
            if (name === "assign_pincodes") {
              v = (assignPincodes || [])
                .map((p) => String(p || "").replace(/\D/g, "").slice(0, 6))
                .filter((p) => /^\d{6}$/.test(p));
            }
          }

          if (v === "" || v === null || v === undefined) continue;

          if (v instanceof File) {
            form.append(name, v);
            continue;
          }

          if (isNumeric(f) && v !== "" && v !== null && v !== undefined) {
            if (f.type === "FloatField" || f.type === "DecimalField") {
              const n = Number(v);
              if (!Number.isNaN(n)) v = n;
            } else {
              const n = parseInt(v, 10);
              if (!Number.isNaN(n)) v = n;
            }
          }

          if (isRelationField(f)) {
            v = coerceRelationValue(f, v);
          }

          if (typeof v === "boolean") {
            form.append(name, v ? "true" : "false");
          } else {
            form.append(name, String(v));
          }
        }
        dataToSend = form;
      } else {
        const payload = {};
        for (const name of changed) {
          const f = formFields.find((x) => x.name === name) || {};
          let v = (name === "username" && newUsernameForSync) ? newUsernameForSync : values[name];

          if (isAdminUsersRoute) {
            if (name === "state") v = stateIdSel ? parseInt(stateIdSel, 10) : "";
            if (!isSC && name === "city") v = cityIdSel ? parseInt(cityIdSel, 10) : "";
            if (!isSC && name === "pincode") v = pin6 || "";
            if (name === "assign_states") {
              v = (assignStates || []).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
            }
            if (name === "assign_districts") {
              v = Array.isArray(assignDistricts) ? assignDistricts : [];
            }
            if (name === "assign_pincodes") {
              v = (assignPincodes || [])
                .map((p) => String(p || "").replace(/\D/g, "").slice(0, 6))
                .filter((p) => /^\d{6}$/.test(p));
            }
          }

          if (isNumeric(f) && v !== "" && v !== null && v !== undefined) {
            if (f.type === "FloatField" || f.type === "DecimalField") {
              const n = Number(v);
              if (!Number.isNaN(n)) v = n;
            } else {
              const n = parseInt(v, 10);
              if (!Number.isNaN(n)) v = n;
            }
          }

          if (isRelationField(f)) {
            v = coerceRelationValue(f, v);
          }

          payload[name] = v;
        }
        dataToSend = payload;
      }

      const url = isEdit ? `${routeNormalized}${record.id || record.pk}/` : routeNormalized;
      if (process.env.NODE_ENV !== "production") {
        try {
          // Debug which endpoint/method and fields we are submitting
          // eslint-disable-next-line no-console
          console.debug("[ModelFormDialog] submit", { url, method: isEdit ? "PATCH" : "POST", changed });
        } catch (_) {}
      }

      try {
        if (isEdit) {
          await API.patch(url, dataToSend);
        } else {
          await API.post(url, dataToSend);
        }
      } catch (err) {
        const status = err?.response?.status;
        const methodNotAllowed = status === 405;
        const unsupported = status === 415;
        // Fallback to PUT only when PATCH is not supported (405) or content type unsupported (415)
        const shouldFallbackPut = methodNotAllowed || unsupported;
        if (shouldFallbackPut) {
          if (process.env.NODE_ENV !== "production") {
            try {
              // eslint-disable-next-line no-console
              console.debug("[ModelFormDialog] PATCH failed, falling back to PUT", { url, status });
            } catch (_) {}
          }
          // Backward-compat: some endpoints only allow PUT (or require full payload)
          const anyFile = (formFields || []).some(
            (f) => !f.read_only && (isFileField(f) && (values[f.name] instanceof File))
          );
          let fullData;
          if (anyFile) {
            const formAll = new FormData();
            for (const f of formFields) {
              if (f.read_only) continue;
              let v = (f.name === "username" && newUsernameForSync) ? newUsernameForSync : values[f.name];

              if (isAdminUsersRoute) {
                if (f.name === "state") v = stateIdSel ? parseInt(stateIdSel, 10) : "";
                if (!isSC && f.name === "city") v = cityIdSel ? parseInt(cityIdSel, 10) : "";
                if (!isSC && f.name === "pincode") v = pin6 || "";
              }

              // For PUT: if current value is empty, fall back to original to avoid clearing required fields
              let veff = (v === "" || v === null || v === undefined) ? original[f.name] : v;

              if (veff instanceof File) {
                formAll.append(f.name, veff);
                continue;
              }

              if (isNumeric(f) && veff !== "" && veff !== null && veff !== undefined) {
                if (String(f.type) === "FloatField" || String(f.type) === "DecimalField") {
                  const n = Number(veff);
                  if (!Number.isNaN(n)) veff = n;
                } else {
                  const n = parseInt(veff, 10);
                  if (!Number.isNaN(n)) veff = n;
                }
              }

              if (isRelationField(f)) veff = coerceRelationValue(f, veff);

              if (veff === undefined) continue; // nothing sensible to send

              if (typeof veff === "boolean") {
                formAll.append(f.name, veff ? "true" : "false");
              } else {
                formAll.append(f.name, String(veff));
              }
            }
            fullData = formAll;
          } else {
            const payloadAll = {};
            for (const f of formFields) {
              if (f.read_only) continue;
              let v = (f.name === "username" && newUsernameForSync) ? newUsernameForSync : values[f.name];

              if (isAdminUsersRoute) {
                if (f.name === "state") v = stateIdSel ? parseInt(stateIdSel, 10) : "";
                if (!isSC && f.name === "city") v = cityIdSel ? parseInt(cityIdSel, 10) : "";
                if (!isSC && f.name === "pincode") v = pin6 || "";
              }

              // For PUT: if current value is empty, fall back to original to avoid clearing required fields
              let veff = (v === "" || v === null || v === undefined) ? original[f.name] : v;

              if (isNumeric(f) && veff !== "" && veff !== null && veff !== undefined) {
                if (String(f.type) === "FloatField" || String(f.type) === "DecimalField") {
                  const n = Number(veff);
                  if (!Number.isNaN(n)) veff = n;
                } else {
                  const n = parseInt(veff, 10);
                  if (!Number.isNaN(n)) veff = n;
                }
              }

              if (isRelationField(f)) veff = coerceRelationValue(f, veff);
              payloadAll[f.name] = veff;
            }
            // Include coordinator multi-assign fields as well (JSON)
            if (isAdminUsersRoute) {
              if (isSC) {
                payloadAll.assign_states = (assignStates || [])
                  .map((x) => parseInt(x, 10))
                  .filter((n) => Number.isFinite(n));
              }
              if (isDC) {
                payloadAll.assign_districts = Array.isArray(assignDistricts) ? assignDistricts : [];
              }
              if (isPC) {
                payloadAll.assign_pincodes = (assignPincodes || [])
                  .map((p) => String(p || "").replace(/\D/g, "").slice(0, 6))
                  .filter((p) => /^\d{6}$/.test(p));
              }
            }
            fullData = payloadAll;
          }

          await API.put(url, fullData);
        } else {
          throw err;
        }
      }
      try {
        onSaved && onSaved();
      } catch (_) {}
      onClose && onClose();
    } catch (e) {
      // Map DRF validation errors { field: ["err"] }
      const data = e?.response?.data || {};
      const mapped = {};
      for (const [k, v] of Object.entries(data)) {
        mapped[k] = Array.isArray(v) ? v.join(", ") : String(v);
      }
      setErrors(mapped);
      try {
        if (!Object.keys(mapped).length) {
          const detail = e?.response?.data?.detail || e?.message || "Request failed";
          setFormError(String(detail));
        }
      } catch (_) {}
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {title || (record ? "Edit" : "Create")}
        <Typography variant="caption" sx={{ ml: 1, color: "text.secondary" }}>
          {route}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {formError ? (
          <Typography color="error" sx={{ mb: 1, fontSize: 13, fontWeight: 600 }}>
            {formError}
          </Typography>
        ) : null}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 2,
            pt: 1,
          }}
        >
          {(formFields || [])
            .filter((f) =>
              f.name !== "id" &&
              f.name !== "pk" &&
              !(record && String(f.name || "").toLowerCase() === "password") &&
              !(isAdminUsersRoute && (f.name === "state" || f.name === "city" || f.name === "pincode"))
            )
            .map((f) => {
              const val = values[f.name];
              const label = f.label || f.name;
              const readOnly = !!f.read_only;
              const relation = isRelationField(f);

              if (isBooleanField(f)) {
                return (
                  <FormControlLabel
                    key={f.name}
                    control={
                      <Switch
                        checked={!!val}
                        onChange={(e) => handleChange(f.name, e.target.checked)}
                        disabled={readOnly}
                      />
                    }
                    label={label}
                  />
                );
              }

              if (isFileField(f)) {
                return (
                  <div key={f.name} style={{ display: "flex", flexDirection: "column" }}>
                    <label style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                      {label}{f.required ? " *" : ""}
                    </label>
                    <input
                      type="file"
                      onChange={(e) =>
                        handleChange(
                          f.name,
                          e.target.files && e.target.files[0] ? e.target.files[0] : null
                        )
                      }
                      disabled={readOnly}
                      accept={(String(f.type || "").toLowerCase().includes("image")) ? "image/*" : undefined}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                      }}
                    />
                    {record && typeof record[f.name] === "string" && record[f.name] ? (
                      <a
                        href={record[f.name]}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: "#0ea5e9", marginTop: 4, wordBreak: "break-all" }}
                      >
                        Current: {record[f.name]}
                      </a>
                    ) : null}
                    <span style={{ color: errors[f.name] ? "#dc2626" : "transparent", fontSize: 12, marginTop: 4 }}>
                      {errors[f.name] || "placeholder"}
                    </span>
                  </div>
                );
              }

              // If backend provides small explicit choices, use them (not for relations)
              if (isChoiceField(f) && !relation) {
                return (
                  <TextField
                    key={f.name}
                    select
                    label={label}
                    value={val ?? ""}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                    disabled={readOnly}
                    required={!!f.required}
                    error={!!errors[f.name]}
                    helperText={errors[f.name] || f.help_text || " "}
                    size="small"
                  >
                    <MenuItem value="">
                      <em></em>
                    </MenuItem>
                    {f.choices.map(([v, text]) => (
                      <MenuItem key={String(v)} value={v}>
                        {text}
                      </MenuItem>
                    ))}
                  </TextField>
                );
              }

              // Render relation dropdown for FK fields
              if (relation) {
                return (
                  <TextField
                    key={f.name}
                    select
                    label={label}
                    value={val ?? ""}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                    disabled={readOnly}
                    required={!!f.required}
                    error={!!errors[f.name]}
                    helperText={errors[f.name] || f.help_text || " "}
                    size="small"
                    SelectProps={{ onOpen: () => fetchRemoteOptions(f.name) }}
                  >
                    <MenuItem value="">
                      <em></em>
                    </MenuItem>
                    {(remoteOptions[f.name] || []).map((opt) => (
                      <MenuItem key={String(opt.value)} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                );
              }

              // Default input
              return (
                <TextField
                  key={f.name}
                  label={label}
                  value={val ?? ""}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  disabled={readOnly}
                  required={!!f.required}
                  error={!!errors[f.name]}
                  helperText={errors[f.name] || f.help_text || " "}
                  size="small"
                  type={inputType(f)}
                  multiline={isMultiline(f)}
                  minRows={isMultiline(f) ? 3 : undefined}
                />
              );
            })}
          {isAdminUsersRoute && (
            <>
              {!isSC ? (
                <TextField
                  select
                  label="State"
                  value={stateIdSel || ""}
                  onChange={(e) => {
                    setStateIdSel(String(e.target.value));
                    setCityIdSel("");
                  }}
                  required
                  error={!!errors.state}
                  helperText={errors.state || " "}
                  size="small"
                >
                  <MenuItem value="">
                    <em></em>
                  </MenuItem>
                  {(geoStates || []).map((s) => (
                    <MenuItem key={String(s.id)} value={String(s.id)}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  select
                  label="States (Max 2)"
                  value={assignStates}
                  onChange={(e) => setAssignStates(Array.from(e.target.value || []).map((v) => String(v)))}
                  SelectProps={{
                    multiple: true,
                    renderValue: (selected) => {
                      const ids = Array.from(selected || []);
                      const names = ids.map((id) => {
                        const st = (geoStates || []).find((x) => String(x.id) === String(id));
                        return st ? st.name : id;
                      });
                      return names.join(", ");
                    },
                  }}
                  helperText="Select one or more states to assign"
                  size="small"
                >
                  {(geoStates || []).map((s) => (
                    <MenuItem key={String(s.id)} value={String(s.id)}>
                      {s.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {!isSC && !isDC && (
                <TextField
                  select
                  label="District"
                  value={cityIdSel || ""}
                  onChange={(e) => setCityIdSel(String(e.target.value))}
                  required
                  error={!!errors.city}
                  helperText={errors.city || " "}
                  size="small"
                  disabled={!stateIdSel}
                >
                  <MenuItem value="">
                    <em></em>
                  </MenuItem>
                  {(geoCities || []).map((c) => {
                    const name = c?.name || c?.Name || c?.city || c?.City;
                    return (
                      <MenuItem key={String(c.id)} value={String(c.id)}>
                        {name}
                      </MenuItem>
                    );
                  })}
                </TextField>
              )}

              {isDC && (
                <TextField
                  select
                  label="Districts (Max 2)"
                  value={assignDistricts}
                  onChange={(e) => setAssignDistricts(Array.from(e.target.value || []).map((v) => String(v)))}
                  SelectProps={{ multiple: true, renderValue: (selected) => (Array.from(selected || [])).join(", ") }}
                  size="small"
                  disabled={!stateIdSel}
                  helperText="Select one or more districts"
                >
                  {(districtOptionsAdmin || []).map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {!isSC && !isDC && !isPC && (
                <TextField
                  label="Pincode"
                  value={pin6}
                  onChange={(e) => setPin6(String(e.target.value || "").replace(/\D/g, "").slice(0, 6))}
                  required
                  error={!!errors.pincode}
                  helperText={errors.pincode || " "}
                  size="small"
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                />
              )}

              {isPC && (
                <TextField
                  select
                  label="Pincodes (Max 4)"
                  value={assignPincodes}
                  onChange={(e) => setAssignPincodes(Array.from(e.target.value || []))}
                  SelectProps={{ multiple: true, renderValue: (selected) => (Array.from(selected || [])).join(", ") }}
                  size="small"
                  disabled={!stateIdSel || !cityIdSel}
                  helperText="Select one or more pincodes"
                >
                  {(pincodeOptionsAdmin || []).map((pin) => (
                    <MenuItem key={pin} value={pin}>
                      {pin}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={onClose} disabled={saving} color="inherit">
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={saving} variant="contained">
          {record ? "Save" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
