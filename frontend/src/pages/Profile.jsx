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
  Tabs,
  Tab,
  Chip,
  Divider,
} from "@mui/material";
import API from "../api/api";
import normalizeMediaUrl from "../utils/media";

function nsFromPath() {
  try {
    const p =
      (typeof window !== "undefined" &&
        window.location &&
        window.location.pathname) ||
      "";
    if (p.startsWith("/agency")) return "agency";
    if (p.startsWith("/employee")) return "employee";
    if (p.startsWith("/business")) return "business";
    return "user";
  } catch {
    return "user";
  }
}

export default function Profile() {
  const ns = useMemo(() => nsFromPath(), []);
  const storedUser = useMemo(() => {
    try {
      const ls =
        localStorage.getItem(`user_${ns}`) ||
        sessionStorage.getItem(`user_${ns}`) ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, [ns]);

  // Tabs
  const [tab, setTab] = useState("personal");

  // Personal details state
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

  // KYC/Bank state
  const [kyc, setKyc] = useState({
    bank_name: "",
    bank_account_number: "",
    ifsc_code: "",
    aadhaar_digilocker_url: "",
    verified: false,
    verified_at: null,
    kyc_reopen_allowed: false,
    can_submit_kyc: true,
  });
  const [kycErr, setKycErr] = useState("");
  const [kycOk, setKycOk] = useState("");
  const [kycBusy, setKycBusy] = useState(false);

  // Aadhaar only save status
  const [aadhaarOk, setAadhaarOk] = useState("");
  const [aadhaarErr, setAadhaarErr] = useState("");
  const [aadhaarBusy, setAadhaarBusy] = useState(false);

  // Nominee (UI-only storage until backend fields are available)
  const nomineeStorageKey = `nominee_${ns}`;
  const [nominee, setNominee] = useState({
    name: "",
    relation: "",
    phone: "",
    address: "",
  });
  const [nomineeOk, setNomineeOk] = useState("");

  useEffect(() => {
    let mounted = true;
    setErr("");
    setOk("");
    setKycErr("");
    setKycOk("");
    (async () => {
      try {
        const [profileRes, kycRes] = await Promise.all([
          API.get("/accounts/profile/"),
          API.get("/accounts/kyc/me/"),
        ]);
        if (!mounted) return;

        // Personal
        const d = profileRes?.data || {};
        setForm({
          email: d.email || "",
          phone: d.phone || "",
          age: (d.age ?? "") === null ? "" : String(d.age ?? ""),
          pincode: d.pincode || "",
        });
        setAddress(d.address || "");
        setAvatarUrl(d.avatar_url || null);

        // KYC
        const k = kycRes?.data || {};
        setKyc({
          bank_name: k.bank_name || "",
          bank_account_number: k.bank_account_number || "",
          ifsc_code: k.ifsc_code || "",
          aadhaar_digilocker_url: k.aadhaar_digilocker_url || "",
          verified: !!k.verified,
          verified_at: k.verified_at || null,
          kyc_reopen_allowed: !!k.kyc_reopen_allowed,
          can_submit_kyc:
            k.can_submit_kyc === undefined ? true : !!k.can_submit_kyc,
        });

        // Nominee (local only)
        try {
          const raw =
            localStorage.getItem(nomineeStorageKey) ||
            sessionStorage.getItem(nomineeStorageKey);
          if (raw) {
            const j = JSON.parse(raw);
            if (j && typeof j === "object") setNominee({ ...nominee, ...j });
          }
        } catch {}
      } catch (e) {
        setErr("Failed to load profile.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [nomineeStorageKey]);

  // Handlers
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
      } catch {}
    }
  }

  async function onSavePersonal() {
    setErr("");
    setOk("");
    setBusy(true);
    try {
      const fd = new FormData();

      // Append only present fields
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
        const preferLocal =
          typeof localStorage !== "undefined" &&
          localStorage.getItem(`refresh_${ns}`) !== null;
        const preferSession =
          typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem(`refresh_${ns}`) !== null;
        const store = preferLocal
          ? localStorage
          : preferSession
          ? sessionStorage
          : localStorage;
        store.setItem(`user_${ns}`, JSON.stringify(data));
        if (ns === "user") {
          try {
            localStorage.setItem("user", JSON.stringify(data));
          } catch {}
          try {
            sessionStorage.setItem("user", JSON.stringify(data));
          } catch {}
        }
      } catch {}
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

  async function saveBankKYC() {
    setKycErr("");
    setKycOk("");
    setKycBusy(true);
    try {
      const payload = {
        bank_name: kyc.bank_name || "",
        bank_account_number: kyc.bank_account_number || "",
        ifsc_code: kyc.ifsc_code || "",
      };
      const res = await API.patch("/accounts/kyc/me/", payload);
      const k = res?.data || {};
      setKyc((prev) => ({ ...prev, ...k }));
      setKycOk("Bank details saved. Verification may be required by admin.");
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (e?.response?.data?.non_field_errors &&
          e.response.data.non_field_errors.join(", ")) ||
        "Failed to save bank details.";
      setKycErr(String(msg));
    } finally {
      setKycBusy(false);
    }
  }

  async function saveAadhaar() {
    setAadhaarErr("");
    setAadhaarOk("");
    setAadhaarBusy(true);
    try {
      const payload = {
        aadhaar_digilocker_url: kyc.aadhaar_digilocker_url || "",
      };
      const res = await API.patch("/accounts/kyc/me/", payload);
      const k = res?.data || {};
      setKyc((prev) => ({ ...prev, ...k }));
      setAadhaarOk("Aadhaar DigiLocker link saved.");
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        "Failed to save Aadhaar DigiLocker link.";
      setAadhaarErr(String(msg));
    } finally {
      setAadhaarBusy(false);
    }
  }

  function saveNomineeLocal() {
    try {
      const store =
        typeof localStorage !== "undefined"
          ? localStorage
          : typeof sessionStorage !== "undefined"
          ? sessionStorage
          : null;
      if (store) {
        store.setItem(nomineeStorageKey, JSON.stringify(nominee));
        setNomineeOk("Nominee details saved locally.");
        setTimeout(() => setNomineeOk(""), 2000);
      }
    } catch {}
  }

  const kycLocked =
    kyc.verified && !kyc.kyc_reopen_allowed && !kyc.can_submit_kyc;

  return (
    <Box sx={{ maxWidth: 880, mx: "auto" }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        Profile
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab value="personal" label="Personal details" />
          <Tab value="bank" label="KYC" />
          <Tab value="nominee" label="Nominee" />
          <Tab value="aadhaar" label="Aadhaar Digi Link" />
        </Tabs>
      </Paper>

      {/* Personal Details */}
      {tab === "personal" && (
        <>
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
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={onAvatarChange}
                  />
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
                inputProps={{
                  inputMode: "numeric",
                  pattern: "[0-9]*",
                  maxLength: 10,
                }}
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
                inputProps={{
                  inputMode: "numeric",
                  pattern: "[0-9]*",
                  maxLength: 3,
                }}
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
                inputProps={{
                  inputMode: "numeric",
                  pattern: "[0-9]*",
                  maxLength: 6,
                }}
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
                <Button variant="contained" disabled={busy} onClick={onSavePersonal}>
                  {busy ? "Saving..." : "Save"}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </>
      )}

      {/* Bank / KYC */}
      {tab === "bank" && (
        <>
          {kycErr ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {kycErr}
            </Alert>
          ) : null}
          {kycOk ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              {kycOk}
            </Alert>
          ) : null}

          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Bank details
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    size="small"
                    color={kyc.verified ? "success" : "default"}
                    label={kyc.verified ? "KYC Verified" : "Not Verified"}
                  />
                  {kyc.verified_at ? (
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Verified at: {new Date(kyc.verified_at).toLocaleString()}
                    </Typography>
                  ) : null}
                </Stack>
              </Stack>

              {kycLocked ? (
                <Alert severity="info">
                  Your KYC is verified. Edits are locked. To update, raise a Support
                  ticket for KYC re-verification.
                </Alert>
              ) : null}

              <TextField
                label="Bank name"
                value={kyc.bank_name}
                onChange={(e) => setKyc((k) => ({ ...k, bank_name: e.target.value }))}
                fullWidth
                size="small"
                disabled={kycLocked}
              />

              <TextField
                label="Account number"
                value={kyc.bank_account_number}
                onChange={(e) =>
                  setKyc((k) => ({
                    ...k,
                    bank_account_number: e.target.value.replace(/[^0-9A-Za-z]/g, ""),
                  }))
                }
                fullWidth
                size="small"
                disabled={kycLocked}
              />

              <TextField
                label="IFSC code"
                value={kyc.ifsc_code}
                onChange={(e) =>
                  setKyc((k) => ({
                    ...k,
                    ifsc_code: e.target.value.toUpperCase().slice(0, 11),
                  }))
                }
                fullWidth
                size="small"
                inputProps={{ maxLength: 11 }}
                disabled={kycLocked}
              />

              <Divider />

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  disabled={kycBusy || kycLocked}
                  onClick={saveBankKYC}
                >
                  {kycBusy ? "Saving..." : "Save Bank Details"}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </>
      )}

      {/* Aadhaar */}
      {tab === "aadhaar" && (
        <>
          {aadhaarErr ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {aadhaarErr}
            </Alert>
          ) : null}
          {aadhaarOk ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              {aadhaarOk}
            </Alert>
          ) : null}

          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Aadhaar DigiLocker
              </Typography>

              {kycLocked ? (
                <Alert severity="info">
                  Your KYC is verified. Edits are locked. To update the Aadhaar
                  DigiLocker link, create a Support ticket for KYC re-verification.
                </Alert>
              ) : null}

              <TextField
                label="DigiLocker URL"
                value={kyc.aadhaar_digilocker_url}
                onChange={(e) =>
                  setKyc((k) => ({ ...k, aadhaar_digilocker_url: e.target.value }))
                }
                placeholder="https://digilocker.gov.in/..."
                fullWidth
                size="small"
                disabled={kycLocked}
              />

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  disabled={aadhaarBusy || kycLocked}
                  onClick={saveAadhaar}
                >
                  {aadhaarBusy ? "Saving..." : "Save Aadhaar Link"}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </>
      )}

      {/* Nominee - Local draft until backend fields exist */}
      {tab === "nominee" && (
        <>
          {nomineeOk ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              {nomineeOk}
            </Alert>
          ) : null}
          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Nominee details
              </Typography>
              <Alert severity="info">
                Nominee information is currently saved on this device only.
                Backend fields will be wired when available.
              </Alert>

              <TextField
                label="Name"
                value={nominee.name}
                onChange={(e) =>
                  setNominee((n) => ({ ...n, name: e.target.value }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Relation"
                value={nominee.relation}
                onChange={(e) =>
                  setNominee((n) => ({ ...n, relation: e.target.value }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Phone"
                value={nominee.phone}
                onChange={(e) =>
                  setNominee((n) => ({
                    ...n,
                    phone: e.target.value.replace(/[^0-9]/g, "").slice(0, 10),
                  }))
                }
                fullWidth
                size="small"
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 10 }}
              />
              <TextField
                label="Address"
                value={nominee.address}
                onChange={(e) =>
                  setNominee((n) => ({ ...n, address: e.target.value }))
                }
                fullWidth
                size="small"
                multiline
                minRows={3}
              />

              <Stack direction="row" spacing={2}>
                <Button variant="contained" onClick={saveNomineeLocal}>
                  Save Nominee (Local)
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </>
      )}
    </Box>
  );
}
