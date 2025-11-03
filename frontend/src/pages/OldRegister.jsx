import { useState, useEffect, useMemo } from "react";
import API from "../api/api";

const AGENCY_CATEGORIES = new Set([
  "agency_state_coordinator",
  "agency_state",
  "agency_district_coordinator",
  "agency_district",
  "agency_pincode_coordinator",
  "agency_pincode",
  "agency_sub_franchise",
]);

export default function Register() {
  // Core form fields
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    category: "consumer", // consumer | employee | business | agency_*...
  });

  const [pincode, setPincode] = useState("");
  const [geoCountryName, setGeoCountryName] = useState("");
  const [geoCountryCode, setGeoCountryCode] = useState("");
  const [geoStateName, setGeoStateName] = useState("");
  const [geoCityName, setGeoCityName] = useState("");
  const [sponsorId, setSponsorId] = useState("");

  // Region inputs and options for agency flow
  const [allStates, setAllStates] = useState([]); // [{id,name}]
  const [sponsorStates, setSponsorStates] = useState([]); // [{id,name}]
  const [sponsorDistricts, setSponsorDistricts] = useState([]); // [{state_id, state, district}]
  const [sponsorPincodes, setSponsorPincodes] = useState([]); // ["585103", ...]
  // Inputs specific to each category
  const [assignStates, setAssignStates] = useState([]); // array of state IDs (SC)
  const [selectedState, setSelectedState] = useState(""); // PK value
  const [assignDistrictsText, setAssignDistrictsText] = useState(""); // comma separated (DC)
  const [selectedDistrict, setSelectedDistrict] = useState(""); // district string (D, PC)
  const [assignPincodesText, setAssignPincodesText] = useState(""); // comma separated (PC)
  const [selectedPincode, setSelectedPincode] = useState(""); // (P, SF)

  // Helper: current category flags
  const isAgency = useMemo(() => AGENCY_CATEGORIES.has(form.category), [form.category]);
  const isSC = form.category === "agency_state_coordinator";
  const isState = form.category === "agency_state";
  const isDC = form.category === "agency_district_coordinator";
  const isDistrict = form.category === "agency_district";
  const isPC = form.category === "agency_pincode_coordinator";
  const isPincode = form.category === "agency_pincode";
  const isSubFranchise = form.category === "agency_sub_franchise";

  // Backend pincode -> country/state/city autofill (avoids external CORS)
  const fetchFromBackendPin = async (code) => {
    const pin = (code || "").replace(/\D/g, "");
    if (pin.length !== 6) return;
    try {
      const resp = await API.get(`/location/pincode/${pin}/`);
      const payload = resp?.data || {};
      const detectedCity = payload.city || payload.district || "";
      const detectedState = payload.state || "";
      const detectedCountry = payload.country || "";
      setGeoCountryName(detectedCountry || "");
      setGeoCountryCode(""); // optional; backend doesn't return iso2 here
      setGeoStateName(detectedState || "");
      setGeoCityName(detectedCity || "");
    } catch {
      // ignore lookup errors
    }
  };

  useEffect(() => {
    const code = (pincode || "").trim();
    if (code.replace(/\D/g, "").length === 6) {
      fetchFromBackendPin(code);
    }
  }, [pincode]);

  // Read sponsor id from URL (?sponsor= / ?sponsor_id= / ?ref=)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("sponsor") || params.get("sponsor_id") || params.get("ref");
      if (s) setSponsorId(s);
    } catch {}
  }, []);

  // Load all states (for SC multi-select)
  useEffect(() => {
    if (!isSC) return;
    (async () => {
      try {
        const resp = await API.get(`/location/states/`);
        const rows = Array.isArray(resp?.data) ? resp.data : resp?.data?.results || [];
        const norm = rows.map((r) => ({ id: r.id, name: r.name }));
        setAllStates(norm);
      } catch {
        setAllStates([]);
      }
    })();
  }, [isSC]);

  // Fetch sponsor-based states whenever sponsorId and agency category change
  useEffect(() => {
    if (!isAgency) return;
    const s = (sponsorId || "").trim();
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
  }, [isAgency, sponsorId, form.category]);

  // Fetch sponsor-based districts whenever selectedState is set (for DC/D/PC)
  useEffect(() => {
    if (!(isDC || isDistrict || isPC)) {
      setSponsorDistricts([]);
      return;
    }
    const s = (sponsorId || "").trim();
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
  }, [isDC, isDistrict, isPC, sponsorId, selectedState]);

  // Fetch sponsor-based pincodes for P and SF
  useEffect(() => {
    if (!(isPincode || isSubFranchise)) {
      setSponsorPincodes([]);
      return;
    }
    const s = (sponsorId || "").trim();
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
  }, [isPincode, isSubFranchise, sponsorId]);

  // Normalize and validate lists from comma-separated text
  const parseDistricts = (txt) => {
    const items = String(txt || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // de-dup case-insensitively
    const seen = new Set();
    const out = [];
    for (const d of items) {
      const key = d.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(d);
      }
    }
    return out;
  };
  const parsePincodes = (txt) => {
    const items = String(txt || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // keep only 6-digit
    const out = [];
    const seen = new Set();
    for (const p of items) {
      if (!/^\d{6}$/.test(p)) continue;
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
    return out;
  };

  const validateAgencyInputs = () => {
    if (!sponsorId.trim()) {
      alert("Sponsor ID is required for agency registrations.");
      return false;
    }
    if (isSC) {
      if (!assignStates.length) {
        alert("Select at least 1 state.");
        return false;
      }
      if (assignStates.length > 2) {
        alert("You can select maximum 2 states.");
        return false;
      }
    } else if (isState) {
      if (!selectedState) {
        alert("Please select a State.");
        return false;
      }
      // Optional: ensure selectedState is among sponsorStates
      if (sponsorStates.length && !sponsorStates.some((s) => String(s.id) === String(selectedState))) {
        alert("Selected State is not under the Sponsor's assignment.");
        return false;
      }
    } else if (isDC) {
      if (!selectedState) {
        alert("Please select a State.");
        return false;
      }
      const districts = parseDistricts(assignDistrictsText);
      if (!districts.length) {
        alert("Provide at least one District (comma separated).");
        return false;
      }
      if (districts.length > 2) {
        alert("You can provide maximum 2 districts.");
        return false;
      }
    } else if (isDistrict) {
      if (!selectedState) {
        alert("Please select a State.");
        return false;
      }
      if (!selectedDistrict.trim()) {
        alert("Please select a District.");
        return false;
      }
      // Optional: ensure selectedDistrict is among sponsorDistricts for selectedState
      if (
        sponsorDistricts.length &&
        !sponsorDistricts.some(
          (d) => String(d.state_id) === String(selectedState) && String(d.district).toLowerCase() === selectedDistrict.trim().toLowerCase()
        )
      ) {
        alert("Selected District is not under the Sponsor's assignment for the chosen State.");
        return false;
      }
    } else if (isPC) {
      if (!selectedState) {
        alert("Please select a State.");
        return false;
      }
      if (!selectedDistrict.trim()) {
        alert("Please select a District.");
        return false;
      }
      const pins = parsePincodes(assignPincodesText);
      if (!pins.length) {
        alert("Provide at least one 6-digit pincode (comma separated).");
        return false;
      }
      if (pins.length > 4) {
        alert("You can provide maximum 4 pincodes.");
        return false;
      }
    } else if (isPincode || isSubFranchise) {
      if (!selectedPincode.trim() || !/^\d{6}$/.test(selectedPincode.trim())) {
        alert("Please select a valid 6-digit pincode.");
        return false;
      }
      if (sponsorPincodes.length && !sponsorPincodes.includes(selectedPincode.trim())) {
        alert("Selected pincode is not under the Sponsor's assignment.");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Sponsor must be provided for all categories per backend serializer
    if (!sponsorId.trim()) {
      alert("Sponsor ID is required.");
      return;
    }

    // Phone requirement for consumer/employee per backend validation
    if ((form.category === "consumer" || form.category === "employee") && !form.phone.trim()) {
      alert("Phone number is required for Consumer and Employee registrations.");
      return;
    }

    // Additional agency-level validations
    if (isAgency && !validateAgencyInputs()) {
      return;
    }

    try {
      const payload = {
        // Do NOT send username, it's generated by backend.
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone,
        category: form.category,
        sponsor_id: sponsorId || "",
        pincode,
        country_name: geoCountryName || "",
        country_code: geoCountryCode || "",
        state_name: geoStateName || "",
        city_name: geoCityName || "",
      };

      // Attach agency-specific fields
      if (isSC) {
        payload.assign_states = assignStates.map((id) => Number(id)).filter(Boolean);
      } else if (isState) {
        if (selectedState) payload.selected_state = Number(selectedState);
      } else if (isDC) {
        if (selectedState) payload.selected_state = Number(selectedState);
        const districts = parseDistricts(assignDistrictsText);
        if (districts.length) payload.assign_districts = districts;
      } else if (isDistrict) {
        if (selectedState) payload.selected_state = Number(selectedState);
        if (selectedDistrict) payload.selected_district = selectedDistrict.trim();
      } else if (isPC) {
        if (selectedState) payload.selected_state = Number(selectedState);
        if (selectedDistrict) payload.selected_district = selectedDistrict.trim();
        const pins = parsePincodes(assignPincodesText);
        if (pins.length) payload.assign_pincodes = pins;
      } else if (isPincode || isSubFranchise) {
        if (selectedPincode) payload.selected_pincode = selectedPincode.trim();
      }

      const resp = await API.post("/accounts/register/", payload);
      const data = resp?.data || {};
      const uname = data.username || "(generated)";
      const uid = data.unique_id || "(pending)";

      alert(
        `Registration successful!\n\nUsername: ${uname}\nUnique ID: ${uid}\n\n` +
          `Notes:\n` +
          `- Consumer login uses TRC + Phone.\n` +
          `- Employee login uses TRE + Phone.\n` +
          `- Agency/Business usernames use their category prefix + 6-digit ID.`
      );
    } catch (err) {
      let msg = "Registration failed.";
      const detail = err?.response?.data;
      if (detail && typeof detail === "object") {
        try {
          msg += " " + JSON.stringify(detail);
        } catch {}
      } else if (err?.message) {
        msg += " " + err.message;
      }
      alert(msg);
    }
  };

  // Helpers for rendering selectable lists
  const renderStateOptions = (source) =>
    (source || []).map((s) => (
      <option key={s.id} value={s.id}>
        {s.name}
      </option>
    ));

  const renderDistrictOptions = () =>
    (sponsorDistricts || [])
      .filter((d) => String(d.state_id) === String(selectedState))
      .map((d) => (
        <option key={`${d.state_id}_${d.district}`} value={d.district}>
          {d.district}
        </option>
      ));

  const selectedStateName = useMemo(() => {
    const inAll =
      isSC && allStates.find((s) => String(s.id) === String(selectedState))?.name;
    const inSponsor =
      !isSC && sponsorStates.find((s) => String(s.id) === String(selectedState))?.name;
    return inAll || inSponsor || "";
  }, [isSC, allStates, sponsorStates, selectedState]);

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
      <h3>Register</h3>

      <input
        placeholder="Full name"
        value={form.full_name}
        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
      />

      <input
        placeholder="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />

      <input
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />

      <input
        placeholder="Phone (required for Consumer/Employee)"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        type="tel"
      />

      <label>
        Category
        <select
          value={form.category}
          onChange={(e) => {
            const nextCat = e.target.value;
            setForm({ ...form, category: nextCat });
            // reset region inputs on category change
            setAssignStates([]);
            setSelectedState("");
            setAssignDistrictsText("");
            setSelectedDistrict("");
            setAssignPincodesText("");
            setSelectedPincode("");
          }}
        >
          <option value="consumer">Consumer (TRC+Phone)</option>
          <option value="employee">Employee (TRE+Phone)</option>
          <option value="agency_state_coordinator">Agency State Coordinator (TRSC+6-digit ID)</option>
          <option value="agency_state">Agency State (TRS+6-digit ID)</option>
          <option value="agency_district_coordinator">Agency District Coordinator (TRDC+6-digit ID)</option>
          <option value="agency_district">Agency District (TRD+6-digit ID)</option>
          <option value="agency_pincode_coordinator">Agency Pincode Coordinator (TRPC+6-digit ID)</option>
          <option value="agency_pincode">Agency Pincode (TRP+6-digit ID)</option>
          <option value="agency_sub_franchise">Agency Sub Franchise (TRSF+6-digit ID)</option>
        </select>
      </label>

      <input
        placeholder="Sponsor ID (required)"
        value={sponsorId}
        onChange={(e) => setSponsorId(e.target.value)}
        required
      />

      {/* Common pincode + geo display (for consumer/employee or additional context) */}
      <input
        placeholder="Pincode"
        value={pincode}
        onChange={(e) => setPincode(e.target.value)}
        type="tel"
      />

      <input placeholder="City" value={geoCityName} disabled />
      <input placeholder="State" value={geoStateName} disabled />
      <input placeholder="Country" value={geoCountryName} disabled />

      {/* Agency-specific region UI */}
      {isSC && (
        <fieldset style={{ border: "1px solid #ddd", padding: 8 }}>
          <legend>State Coordinator: Assign up to 2 States</legend>
          <label>
            Select States (hold Ctrl/Cmd to multi-select)
            <select
              multiple
              value={assignStates.map(String)}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                setAssignStates(selected);
              }}
              style={{ minHeight: 120 }}
            >
              {renderStateOptions(allStates)}
            </select>
          </label>
          <div style={{ fontSize: 12, color: "#666" }}>Max 2 states allowed.</div>
        </fieldset>
      )}

      {isState && (
        <fieldset style={{ border: "1px solid #ddd", padding: 8 }}>
          <legend>State: Select State from Sponsor</legend>
          <label>
            State
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
            >
              <option value="">-- Select --</option>
              {renderStateOptions(sponsorStates)}
            </select>
          </label>
        </fieldset>
      )}

      {isDC && (
        <fieldset style={{ border: "1px solid #ddd", padding: 8 }}>
          <legend>District Coordinator: Select State and provide up to 2 Districts</legend>
          <label>
            State (under Sponsor)
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setAssignDistrictsText("");
              }}
            >
              <option value="">-- Select --</option>
              {renderStateOptions(sponsorStates)}
            </select>
          </label>
          <label>
            Districts (comma separated, Max 2)
            <input
              placeholder="e.g., Kalaburagi, Vijayapura"
              value={assignDistrictsText}
              onChange={(e) => setAssignDistrictsText(e.target.value)}
              disabled={!selectedState}
            />
          </label>
        </fieldset>
      )}

      {isDistrict && (
        <fieldset style={{ border: "1px solid #ddd", padding: 8 }}>
          <legend>District: Select State and District from Sponsor</legend>
          <label>
            State (under Sponsor)
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict("");
              }}
            >
              <option value="">-- Select --</option>
              {renderStateOptions(sponsorStates)}
            </select>
          </label>
          <label>
            District
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={!selectedState}
            >
              <option value="">-- Select --</option>
              {renderDistrictOptions()}
            </select>
          </label>
        </fieldset>
      )}

      {isPC && (
        <fieldset style={{ border: "1px solid #ddd", padding: 8 }}>
          <legend>Pincode Coordinator: Select State, District and provide up to 4 pincodes</legend>
          <label>
            State (under Sponsor)
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict("");
                setAssignPincodesText("");
              }}
            >
              <option value="">-- Select --</option>
              {renderStateOptions(sponsorStates)}
            </select>
          </label>
          <label>
            District (under Sponsor)
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              disabled={!selectedState}
            >
              <option value="">-- Select --</option>
              {renderDistrictOptions()}
            </select>
          </label>
          <label>
            Pincodes (comma separated, 6-digit, Max 4)
            <input
              placeholder="e.g., 585103, 560001"
              value={assignPincodesText}
              onChange={(e) => setAssignPincodesText(e.target.value)}
              disabled={!selectedState || !selectedDistrict}
            />
          </label>
        </fieldset>
      )}

      {(isPincode || isSubFranchise) && (
        <fieldset style={{ border: "1px solid #ddd", padding: 8 }}>
          <legend>{isPincode ? "Pincode" : "Sub-Franchise"}: Select Pincode from Sponsor</legend>
          <label>
            Pincode
            <select
              value={selectedPincode}
              onChange={(e) => setSelectedPincode(e.target.value)}
            >
              <option value="">-- Select --</option>
              {(sponsorPincodes || []).map((pin) => (
                <option key={pin} value={pin}>
                  {pin}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
      )}

      <button type="submit">Register</button>
    </form>
  );
}
