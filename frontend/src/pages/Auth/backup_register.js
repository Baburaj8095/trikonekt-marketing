// src/components/Auth/Register.js
import React, { useState, useEffect } from "react";
import {
  TextField,
  Button,
  Typography,
  Box,
  Paper,
} from "@mui/material";
import API from "../../api/api";
import PublicNavbar from "../../components/PublicNavbar";
import RoleSelector from "./RoleSelector";
import { useNavigate, useLocation } from "react-router-dom";

const Register = () => {
  const [role, setRole] = useState("user");
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [file, setFile] = useState(null);
  const [pincode, setPincode] = useState("");
  const [geoCountryName, setGeoCountryName] = useState("");
  const [geoCountryCode, setGeoCountryCode] = useState("");
  const [geoStateName, setGeoStateName] = useState("");
  const [geoCityName, setGeoCityName] = useState("");
  const [sponsorId, setSponsorId] = useState("");

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qRole = params.get("role");
    if (qRole) setRole(qRole);
    const s = params.get("sponsor") || params.get("sponsor_id") || params.get("ref");
    if (s) setSponsorId(s);
  }, [location.search]);

  // Geoapify pincode -> location autofill (use county as city)
  const GEOAPIFY_KEY = "655e1106608c4df1a2d9adcc05b05476";
  const fetchFromGeoapify = async (code) => {
    try {
      const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
        code
      )}&type=postcode&limit=1&format=json&apiKey=${GEOAPIFY_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      const first = data?.results?.[0];
      if (!first) return;

      const country_name = first.country || "";
      const country_code = (first.country_code || "").toUpperCase();
      const state_name = first.state || "";
      // use county as city, remove taluk variants and normalize spaces
      const raw_city = first.county || "";
      const city_name = (raw_city || "")
        .replace(/\b(taluk|taluka|taluku)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      setGeoCountryName(country_name);
      setGeoCountryCode(country_code);
      setGeoStateName(state_name);
      setGeoCityName(city_name);
    } catch (e) {
      // silent fail; user can still register manually
      console.error("Geoapify lookup failed", e);
    }
  };

  useEffect(() => {
    const code = (pincode || "").trim();
    if (code.length >= 4) {
      fetchFromGeoapify(code);
    }
  }, [pincode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const data = new FormData();
    data.append("username", formData.username);
    data.append("email", formData.email);
    data.append("password", formData.password);
    data.append("role", role);
    if (sponsorId) data.append("sponsor_id", sponsorId);
    if (file) data.append("file", file);
    // Geoapify-assisted location fields
    if (pincode) data.append("pincode", pincode);
    if (geoCountryName) data.append("country_name", geoCountryName);
    if (geoCountryCode) data.append("country_code", geoCountryCode);
    if (geoStateName) data.append("state_name", geoStateName);
    if (geoCityName) data.append("city_name", geoCityName);

    try {
      await API.post("/accounts/register/", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Registration successful!");
      navigate(`/login?role=${role}`, { replace: true });
    } catch (err) {
      console.error(err);
      alert("Registration failed!");
    }
  };

  return (
    <>
      <PublicNavbar />
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f7f9fc", p: 2 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2, width: "100%", maxWidth: 480, minHeight: 480 }}>
        <Typography variant="h4" align="center" sx={{ mb: 2 }}>
          Register
        </Typography>
        <form onSubmit={handleSubmit}>
          <RoleSelector role={role} setRole={setRole} />
          <TextField
            label="Username"
            name="username"
            fullWidth
            margin="normal"
            value={formData.username}
            onChange={handleChange}
            required
          />
          <TextField
            label="Email"
            name="email"
            fullWidth
            margin="normal"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            fullWidth
            margin="normal"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <TextField
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            fullWidth
            margin="normal"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
          {/* Sponsor ID (optional; auto-filled from ?sponsor= / ?sponsor_id= / ?ref=) */}
          <TextField
            label="Sponsor ID"
            fullWidth
            margin="normal"
            value={sponsorId}
            onChange={(e) => setSponsorId(e.target.value)}
            placeholder="Enter Sponsor ID (if any)"
          />

          {/* Pincode first */}
          <TextField
            label="Pincode"
            fullWidth
            margin="normal"
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            type="tel"
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
            helperText={
              geoStateName || geoCityName || geoCountryName
                ? `Detected: ${[geoCityName, geoStateName, geoCountryCode || geoCountryName].filter(Boolean).join(", ")}`
                : ""
            }
          />

          {/* City (non-editable) */}
          <TextField
            label="City"
            fullWidth
            margin="normal"
            value={geoCityName}
            disabled
          />

          {/* State (non-editable) */}
          <TextField
            label="State"
            fullWidth
            margin="normal"
            value={geoStateName}
            disabled
          />

          {/* Country (non-editable) */}
          <TextField
            label="Country"
            fullWidth
            margin="normal"
            value={geoCountryName}
            disabled
          />
          <Button
            variant="contained"
            component="label"
            fullWidth
            sx={{ mt: 2 }}
          >
            Upload File (PDF/Image)
            <input
              type="file"
              hidden
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 3 }}
          >
            Register
          </Button>
        </form>
      </Paper>
    </Box>
    </>
  );
};

export default Register;
