import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Avatar,
  Alert,
} from "@mui/material";
import API from "../api/api";
import normalizeMediaUrl from "../utils/media";

export default function Profile() {
  const storedUser = useMemo(() => {
    try {
      const p = (typeof window !== "undefined" && window.location && window.location.pathname) || "";
      const ns = p.startsWith("/agency") ? "agency" : p.startsWith("/employee") ? "employee" : p.startsWith("/business") ? "business" : "user";
      const ls =
        localStorage.getItem(`user_${ns}`) ||
        sessionStorage.getItem(`user_${ns}`) ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);

  const [form, setForm] = useState({
    email: "",
    phone: "",
    age: "",
    pincode: "",
  });
  const [address, setAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    let mounted = true;
    setErr("");
    setOk("");
    (async () => {
      try {
        const res = await API.get("/accounts/profile/");
        if (!mounted) return;
        const d = res?.data || {};
        setForm({
          email: d.email || "",
          phone: d.phone || "",
          age: (d.age ?? "") === null ? "" : String(d.age ?? ""),
          pincode: d.pincode || "",
        });
        setAddress(d.address || "");
        setAvatarUrl(d.avatar_url || null);
      } catch (e) {
        setErr("Failed to load profile.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function onAvatarChange(e) {
    const f = e.target.files && e.target.files[0];
    if (f) {
      setAvatarFile(f);
      try {
        const url = URL.createObjectURL(f);
        setAvatarUrl(url);
      } catch (_) {}
    }
  }

  async function onSave() {
    setErr("");
    setOk("");
    setBusy(true);
    try {
      const fd = new FormData();

      // Append only present fields to avoid overwriting with empty if user didn't touch
      if (form.email !== undefined) fd.append("email", form.email);
      if (form.phone !== undefined) fd.append("phone", form.phone);
      if (form.pincode !== undefined) fd.append("pincode", form.pincode);

      // age: allow blank to clear
      if (form.age === "" || form.age === null) {
        fd.append("age", "");
      } else {
        fd.append("age", String(form.age));
      }

      if (address !== undefined) fd.append("address", address);
      if (avatarFile) fd.append("avatar", avatarFile);

      await API.patch("/accounts/profile/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setOk("Profile updated successfully.");
      // Refresh cached user (best-effort) with correct namespace
      try {
        const me = await API.get("/accounts/me/");
        const data = me?.data || {};
        const p = (typeof window !== "undefined" && window.location && window.location.pathname) || "";
        const ns = p.startsWith("/agency") ? "agency" : p.startsWith("/employee") ? "employee" : p.startsWith("/business") ? "business" : "user";
        const preferLocal = typeof localStorage !== "undefined" && localStorage.getItem(`refresh_${ns}`) !== null;
        const preferSession = typeof sessionStorage !== "undefined" && sessionStorage.getItem(`refresh_${ns}`) !== null;
        const store = preferLocal ? localStorage : (preferSession ? sessionStorage : localStorage);
        store.setItem(`user_${ns}`, JSON.stringify(data));
        // Maintain legacy 'user' cache only for consumer routes
        if (ns === "user") {
          try { localStorage.setItem("user", JSON.stringify(data)); } catch {}
          try { sessionStorage.setItem("user", JSON.stringify(data)); } catch {}
        }
      } catch (_) {}
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        "Failed to update profile.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        My Profile
      </Typography>

      {err ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      ) : null}
      {ok ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {ok}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={avatarUrl ? normalizeMediaUrl(avatarUrl) : undefined}
              alt={storedUser?.username || "You"}
              sx={{ width: 72, height: 72 }}
            />
            <Button variant="outlined" component="label">
              Upload personal photo
              <input type="file" accept="image/*" hidden onChange={onAvatarChange} />
            </Button>
          </Stack>

          <TextField
            label="Mail Id"
            name="email"
            value={form.email}
            onChange={onChange}
            fullWidth
            size="small"
            type="email"
          />

          <TextField
            label="Phone number"
            name="phone"
            value={form.phone}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
              setForm((f) => ({ ...f, phone: v }));
            }}
            fullWidth
            size="small"
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
          />

          <TextField
            label="Age"
            name="age"
            value={form.age}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
              setForm((f) => ({ ...f, age: v }));
            }}
            fullWidth
            size="small"
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 3 }}
          />

          <TextField
            label="Pincode"
            name="pincode"
            value={form.pincode}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
              setForm((f) => ({ ...f, pincode: v }));
            }}
            fullWidth
            size="small"
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
          />

          <TextField
            label="Address (optional)"
            multiline
            minRows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            fullWidth
            size="small"
          />

          <Stack direction="row" spacing={2}>
            <Button variant="contained" disabled={busy} onClick={onSave}>
              {busy ? "Saving..." : "Save"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
