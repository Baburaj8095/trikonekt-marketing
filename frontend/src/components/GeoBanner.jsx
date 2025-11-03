import React, { useState, useEffect } from "react";
import { Box, Container, Typography, CircularProgress, Button, TextField, Autocomplete } from "@mui/material";
import useGeoAddress from "../hooks/useGeoAddress";

const Field = ({ label, value }) => {
  if (!value) return null;
  return (
    <Box component="span" sx={{ mr: 2, display: "inline-block" }}>
      <Typography component="span" sx={{ fontWeight: 600, mr: 0.5 }}>
        {label}:
      </Typography>
      <Typography component="span">{value}</Typography>
    </Box>
  );
};

export default function GeoBanner() {
  const { address, loading, error, refresh, supported, resolveFromPincode, searchPostOffices } = useGeoAddress({
    auto: true,
    geolocationOptions: { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
    accuracyThreshold: 500,
    watchTimeoutMs: 20000,
  });
  const [pin, setPin] = useState("");
  const [place, setPlace] = useState("");
  const [selVillage, setSelVillage] = useState(null);
  const [selGram, setSelGram] = useState(null);

  // Reset selections when pincode result changes
  useEffect(() => {
    setSelVillage(null);
    setSelGram(null);
  }, [address?.pincode, Array.isArray(address?.villages) ? address.villages.length : 0, Array.isArray(address?.gram_panchayats) ? address.gram_panchayats.length : 0]);

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 1, md: 2 }, mb: { xs: 2, md: 3 }, px: { xs: 2, md: 0 } }}>
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: 1.5,
          p: { xs: 1.5, md: 2 },
          borderRadius: 2,
          bgcolor: "#F3F7FF",
          border: "1px solid #DFE8FF",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#0C2D48", mb: 0.5 }}>
            Your Location
          </Typography>

          {!supported ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Geolocation is not supported by this device or browser.
            </Typography>
          ) : loading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Detecting your location…
              </Typography>
            </Box>
          ) : error ? (
            <Typography variant="body2" sx={{ color: "#b31d1d" }}>
              {error}
            </Typography>
          ) : address ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
                <Field label="Village" value={selVillage || address.village} />
                <Field label="Gram Panchayat" value={selGram || address.gram_panchayat} />
                <Field label="City" value={address.city} />
                <Field label="District" value={address.district} />
                <Field label="State" value={address.state} />
                <Field label="Country" value={address.country} />
                <Field label="Pincode" value={address.pincode} />
              </Box>
              {(address.lat && address.lon) ? (
                <>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Lat: {address.lat}, Lon: {address.lon}
                      {typeof address.accuracy === "number" ? ` • ±${Math.round(address.accuracy)}m` : ""}
                    </Typography>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${address.lat}&mlon=${address.lon}#map=17/${address.lat}/${address.lon}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12 }}
                    >
                      View on map
                    </a>
                  </Box>
                  {typeof address.accuracy === "number" && address.accuracy > 800 ? (
                    <Typography variant="caption" sx={{ color: "#b36b00" }}>
                      Location seems approximate. Connect to Wi‑Fi and enable GPS, then tap Refresh to improve accuracy.
                    </Typography>
                  ) : null}
                </>
              ) : null}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Location not available.
            </Typography>
          )}
        </Box>

        <Box sx={{ flexShrink: 0, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            size="small"
            onClick={refresh}
            disabled={loading || !supported}
            sx={{ whiteSpace: "nowrap" }}
          >
            Refresh location
          </Button>
          <TextField
            label="Pincode"
            size="small"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputProps={{ inputMode: "numeric", pattern: "\\d{6}", maxLength: 6 }}
            sx={{ width: 110 }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={() => resolveFromPincode(pin)}
            disabled={loading || pin.length !== 6}
          >
            Use pincode
          </Button>
          <TextField
            label="Place (village/town/district)"
            size="small"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            sx={{ minWidth: 260 }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={() => searchPostOffices(place, pin)}
            disabled={loading || !place.trim()}
          >
            Find post offices
          </Button>

          {/* Suggestions from pincode/place lookup */}
          {Array.isArray(address?.villages) && address.villages.length > 0 ? (
            <Autocomplete
              size="small"
              options={address.villages}
              value={selVillage}
              onChange={(_, v) => setSelVillage(v)}
              renderInput={(params) => <TextField {...params} label="Select village" />}
              sx={{ minWidth: 220 }}
              disableClearable={false}
            />
          ) : null}
          {Array.isArray(address?.gram_panchayats) && address.gram_panchayats.length > 0 ? (
            <Autocomplete
              size="small"
              options={address.gram_panchayats}
              value={selGram}
              onChange={(_, v) => setSelGram(v)}
              renderInput={(params) => <TextField {...params} label="Select gram panchayat" />}
              sx={{ minWidth: 260 }}
              disableClearable={false}
            />
          ) : null}

          {/* Helper message if service returns no data */}
          {address?.message ? (
            <Typography variant="caption" sx={{ color: "text.secondary", ml: 1 }}>
              {address.message}
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Container>
  );
}
