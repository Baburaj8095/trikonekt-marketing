import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import API from "../api/api";

const DEFAULT_GEO_OPTS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

/**
 * useGeoAddress
 * - Requests browser geolocation (lat/lon)
 * - Calls backend: POST /api/location/reverse/ to resolve pincode, village, gram_panchayat, city, state, country
 *
 * Returns:
 * {
 *   coords: { lat, lon } | null,
 *   address: {
 *     pincode, village, gram_panchayat, city, state, country,
 *     lat, lon, source
 *   } | null,
 *   loading: boolean,
 *   error: string | null,
 *   refresh: () => void,   // re-run detection & reverse lookup
 * }
 */
export default function useGeoAddress(options = {}) {
  const {
    auto = true,
    geolocationOptions,
    accuracyThreshold = 1500,   // meters; if accuracy worse than this, try to improve
    watchTimeoutMs = 15000,     // how long to wait for a better fix
  } = options;

  const geoOpts = useMemo(
    () => geolocationOptions || DEFAULT_GEO_OPTS,
    [geolocationOptions?.enableHighAccuracy, geolocationOptions?.timeout, geolocationOptions?.maximumAge]
  );

  const [coords, setCoords] = useState(null);
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inflight = useRef(false);
  const autoRunRef = useRef(false);
  const watchIdRef = useRef(null);
  const watchTimerRef = useRef(null);

  const supported = useMemo(() => typeof navigator !== "undefined" && !!navigator.geolocation, []);

  const reverseLookup = useCallback(
    async (lat, lon) => {
      try {
        const resp = await API.post("/location/reverse/", { lat, lon });
        return resp?.data || null;
      } catch (e) {
        // Prefer concise, user-safe message
        const msg =
          e?.response?.data?.detail ||
          e?.message ||
          "Failed to resolve address from coordinates";
        throw new Error(msg);
      }
    },
    []
  );

  const resolveFromPincode = useCallback(
    async (pin) => {
      const sanitized = String(pin || "").trim();
      if (!/^\d{6}$/.test(sanitized)) {
        setError("Please enter a valid 6-digit pincode");
        return;
      }
      if (inflight.current) return;
      inflight.current = true;
      setLoading(true);
      setError(null);
      try {
        const resp = await API.get(`/location/pincode/${sanitized}/`);
        const data = resp?.data || null;
        setAddress(data);
        if (data?.lat && data?.lon) {
          setCoords({ lat: data.lat, lon: data.lon });
        } else {
          setCoords(null);
        }
      } catch (e) {
        const msg =
          e?.response?.data?.detail ||
          e?.message ||
          "Failed to resolve address from pincode";
        setError(msg);
        setAddress(null);
      } finally {
        inflight.current = false;
        setLoading(false);
      }
    },
    []
  );

  const searchPostOffices = useCallback(
    async (q, pinOverride) => {
      const query = String(q || "").trim();
      const pin = String(pinOverride || address?.pincode || "").trim();
      if (!query) {
        setError("Please enter a place name to search");
        return;
      }
      if (inflight.current) return;
      inflight.current = true;
      setLoading(true);
      setError(null);
      try {
        const resp = await API.get("/location/postoffice/search/", {
          params: pin && /^\d{6}$/.test(pin) ? { q: query, pin } : { q: query },
        });
        const data = resp?.data || {};
        setAddress((prev) => {
          const base = prev || {};
          return {
            ...base,
            pincode: pin || base.pincode || null,
            city: base.city || null,
            district: base.district || null,
            state: base.state || null,
            country: base.country || null,
            villages: Array.isArray(data.villages) ? data.villages : [],
            gram_panchayats: Array.isArray(data.gram_panchayats) ? data.gram_panchayats : [],
            message: data.message || base.message || null,
            source: { ...(base.source || {}), postal_ok: !!data?.source?.postal_ok },
          };
        });
      } catch (e) {
        const msg =
          e?.response?.data?.detail ||
          e?.message ||
          "Failed to search post offices";
        setError(msg);
      } finally {
        inflight.current = false;
        setLoading(false);
      }
    },
    [address?.pincode]
  );

  const detect = useCallback(() => {
    if (!supported) {
      setError("Geolocation is not supported by this browser/device");
      return;
    }
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    setError(null);

    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          let finished = false;
          let bestPos = pos;

          const clearWatchers = () => {
            try {
              if (watchIdRef.current != null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
            } catch (_) {}
            try {
              if (watchTimerRef.current) {
                clearTimeout(watchTimerRef.current);
                watchTimerRef.current = null;
              }
            } catch (_) {}
          };

          const usePosition = async (p) => {
            if (finished) return;
            finished = true;
            clearWatchers();
            try {
              const lat = p?.coords?.latitude;
              const lon = p?.coords?.longitude;
              if (typeof lat !== "number" || typeof lon !== "number") {
                throw new Error("Invalid coordinates received from device");
              }
              setCoords({ lat, lon });
              const data = await reverseLookup(lat, lon);
              setAddress({
                ...data,
                accuracy: p?.coords?.accuracy,
                accuracy_source: "browser",
                coords_timestamp: p?.timestamp || Date.now(),
              });
            } catch (err) {
              setError(err?.message || "Failed to resolve address");
              setAddress(null);
            } finally {
              inflight.current = false;
              setLoading(false);
            }
          };

          try {
            const acc = pos?.coords?.accuracy;
            if (typeof acc === "number" && acc > accuracyThreshold) {
              // Attempt to improve accuracy via watchPosition for a short time
              watchIdRef.current = navigator.geolocation.watchPosition(
                (p) => {
                  const bestAcc = bestPos?.coords?.accuracy ?? Infinity;
                  const curAcc = p?.coords?.accuracy ?? Infinity;
                  if (curAcc < bestAcc) {
                    bestPos = p;
                  }
                  if (curAcc <= accuracyThreshold) {
                    usePosition(p);
                  }
                },
                () => {},
                { ...geoOpts, enableHighAccuracy: true, maximumAge: 0 }
              );

              watchTimerRef.current = setTimeout(() => {
                usePosition(bestPos || pos);
              }, watchTimeoutMs);
            } else {
              // Good enough accuracy; use immediately
              await usePosition(pos);
            }
          } catch (err) {
            // Fallback to immediate usage on any unexpected errors
            await usePosition(pos);
          }
        },
        (geoErr) => {
          let msg = "Geolocation permission denied or unavailable";
          if (geoErr?.code === 1) msg = "Permission denied for geolocation";
          else if (geoErr?.code === 2) msg = "Position unavailable";
          else if (geoErr?.code === 3) msg = "Geolocation timed out";
          setError(msg);
          setCoords(null);
          setAddress(null);
          inflight.current = false;
          setLoading(false);
        },
        geoOpts
      );
    } catch (e) {
      setError("Failed to access geolocation");
      setCoords(null);
      setAddress(null);
      inflight.current = false;
      setLoading(false);
    }
  }, [geoOpts, reverseLookup, supported]);

  // Auto-run once on mount if enabled (guarded for React 18 StrictMode)
  useEffect(() => {
    if (auto && !autoRunRef.current) {
      autoRunRef.current = true;
      detect();
    }
  }, [auto, detect]);

  const refresh = useCallback(() => {
    detect();
  }, [detect]);

  return { coords, address, loading, error, refresh, supported, resolveFromPincode, searchPostOffices };
}
