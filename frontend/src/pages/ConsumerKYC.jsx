import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import API from "../api/api";
import { useNavigate } from "react-router-dom";

function readStoredUser() {
  try {
    const ls =
      localStorage.getItem("user_user") ||
      sessionStorage.getItem("user_user") ||
      localStorage.getItem("user") ||
      sessionStorage.getItem("user");
    const parsed = ls ? JSON.parse(ls) : {};
    return parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object"
      ? parsed.user
      : parsed;
  } catch {
    return {};
  }
}

function updateStoredUser(nextUser) {
  const keys = ["user_user", "user"];
  [localStorage, sessionStorage].forEach((store) => {
    keys.forEach((key) => {
      try {
        const raw = store.getItem(key);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const next =
          parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object"
            ? { ...parsed, user: { ...parsed.user, ...nextUser } }
            : { ...(parsed || {}), ...nextUser };
        store.setItem(key, JSON.stringify(next));
      } catch (_) {}
    });
  });
}

export default function ConsumerKYC() {
  const storedUser = useMemo(() => readStoredUser(), []);
  const navigate = useNavigate();

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [profileForm, setProfileForm] = useState({
    full_name: storedUser?.full_name || "",
    email: storedUser?.email || "",
  });

  const [kycForm, setKycForm] = useState({
    bank_name: "",
    bank_account_number: "",
    ifsc_code: "",
    aadhaar_digilocker_url: "",
  });
  const [kycMeta, setKycMeta] = useState({
    verified: false,
    verified_at: null,
    updated_at: null,
    can_submit_kyc: true,
    kyc_reopen_allowed: false,
  });

  const [nominees, setNominees] = useState([]);
  const emptyNominee = { id: null, name: "", relationship: "", phone: "", share_percent: "" };
  const [nomineeForm, setNomineeForm] = useState(emptyNominee);

  const locked = kycMeta.verified && !kycMeta.can_submit_kyc;
  const displayName = profileForm.full_name || storedUser?.username || "Consumer";

  const clearAlerts = () => {
    setError("");
    setMessage("");
  };

  const loadProfile = async () => {
    try {
      const res = await API.get("/accounts/profile/");
      const data = res?.data || {};
      setProfileForm({
        full_name: data.full_name || "",
        email: data.email || "",
      });
      updateStoredUser({ full_name: data.full_name || "", email: data.email || "" });
    } catch (_) {}
  };

  const loadKYC = async () => {
    const res = await API.get("/accounts/kyc/me/");
    const data = res?.data || {};
    setKycForm({
      bank_name: data.bank_name || "",
      bank_account_number: data.bank_account_number || "",
      ifsc_code: data.ifsc_code || "",
      aadhaar_digilocker_url: data.aadhaar_digilocker_url || "",
    });
    setKycMeta({
      verified: Boolean(data.verified),
      verified_at: data.verified_at || null,
      updated_at: data.updated_at || null,
      can_submit_kyc: data?.can_submit_kyc !== undefined ? !!data.can_submit_kyc : !data?.verified,
      kyc_reopen_allowed: !!data?.kyc_reopen_allowed,
    });
  };

  const loadNominees = async () => {
    const res = await API.get("/accounts/nominees/");
    const data = res?.data || [];
    setNominees(Array.isArray(data) ? data : data.results || []);
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      clearAlerts();
      await Promise.all([loadProfile(), loadKYC(), loadNominees()]);
    } catch (_) {
      setError("Failed to load account details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const validateKYC = () => {
    const { bank_name, bank_account_number, ifsc_code } = kycForm;
    if (!String(bank_name || "").trim()) return "Bank name is required.";
    const acc = String(bank_account_number || "").trim();
    if (!acc || acc.length < 6) return "Enter a valid bank account number.";
    const ifsc = String(ifsc_code || "").trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc)) return "Enter a valid IFSC code (e.g., HDFC0001234).";
    return "";
  };

  const saveKYC = async (e) => {
    e.preventDefault();
    clearAlerts();
    const validation = validateKYC();
    if (validation) {
      setError(validation);
      return;
    }
    if (locked) {
      setError("KYC is verified and locked. Please create a Support ticket to request re-verification.");
      return;
    }
    try {
      setSaving(true);
      const payload = {
        bank_name: String(kycForm.bank_name || "").trim(),
        bank_account_number: String(kycForm.bank_account_number || "").trim(),
        ifsc_code: String(kycForm.ifsc_code || "").trim().toUpperCase(),
        aadhaar_digilocker_url: String(kycForm.aadhaar_digilocker_url || "").trim(),
      };
      const res = await API.put("/accounts/kyc/me/", payload);
      const data = res?.data || {};
      setMessage("KYC details saved.");
      setKycMeta({
        verified: Boolean(data.verified),
        verified_at: data.verified_at || null,
        updated_at: data.updated_at || null,
        can_submit_kyc: data?.can_submit_kyc !== undefined ? !!data.can_submit_kyc : !data?.verified,
        kyc_reopen_allowed: !!data?.kyc_reopen_allowed,
      });
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : "Failed to save KYC.");
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    clearAlerts();
    const fullName = String(profileForm.full_name || "").trim();
    const email = String(profileForm.email || "").trim();
    if (!fullName) {
      setError("Name is required.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    try {
      setSaving(true);
      const res = await API.patch("/accounts/profile/", { full_name: fullName, email });
      const data = res?.data || {};
      const nextUser = {
        full_name: data.full_name || fullName,
        email: data.email || email,
      };
      setProfileForm(nextUser);
      updateStoredUser(nextUser);
      setMessage("Profile updated. Admin Team Consumers table will reflect this after refresh.");
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : "Failed to update profile.");
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const nomineeTotal = (rows = nominees, excludeId = nomineeForm.id) => {
    return rows.reduce((sum, row) => {
      if (excludeId && String(row.id) === String(excludeId)) return sum;
      return sum + Number(row.share_percent || 0);
    }, 0);
  };

  const saveNominee = async (e) => {
    e.preventDefault();
    clearAlerts();
    const payload = {
      name: String(nomineeForm.name || "").trim(),
      relationship: String(nomineeForm.relationship || "").trim(),
      phone: String(nomineeForm.phone || "").trim(),
      share_percent: Number(nomineeForm.share_percent || 0),
    };
    if (!payload.name) {
      setError("Nominee name is required.");
      return;
    }
    if (payload.share_percent < 0 || payload.share_percent > 100) {
      setError("Share percent must be between 0 and 100.");
      return;
    }
    if (nomineeTotal(nominees, nomineeForm.id) + payload.share_percent > 100) {
      setError("Total nominee share percent cannot exceed 100.");
      return;
    }
    try {
      setSaving(true);
      if (nomineeForm.id) {
        await API.patch(`/accounts/nominees/${encodeURIComponent(nomineeForm.id)}/`, payload);
        setMessage("Nominee updated.");
      } else {
        await API.post("/accounts/nominees/", payload);
        setMessage("Nominee added.");
      }
      setNomineeForm(emptyNominee);
      await loadNominees();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : "Failed to save nominee.");
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const editNominee = (row) => {
    clearAlerts();
    setNomineeForm({
      id: row.id,
      name: row.name || "",
      relationship: row.relationship || "",
      phone: row.phone || "",
      share_percent: row.share_percent ?? "",
    });
  };

  const deleteNominee = async (row) => {
    if (!window.confirm(`Delete nominee ${row.name || ""}?`)) return;
    clearAlerts();
    try {
      setSaving(true);
      await API.delete(`/accounts/nominees/${encodeURIComponent(row.id)}/`);
      setMessage("Nominee deleted.");
      if (String(nomineeForm.id || "") === String(row.id)) setNomineeForm(emptyNominee);
      await loadNominees();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to delete nominee.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ px: { xs: 0, md: 2 }, py: { xs: 1, md: 2 } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: "#0C2D48" }}>
            KYC & Profile Settings
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Manage bank KYC, nominees, and profile details
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {displayName}
        </Typography>
      </Box>

      <Paper elevation={3} sx={{ borderRadius: 3, overflow: "hidden" }}>
        <Tabs
          value={tab}
          onChange={(_, v) => {
            clearAlerts();
            setTab(v);
          }}
          variant="scrollable"
          scrollButtons={false}
          sx={{ px: 1, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Tab label="Bank KYC" />
          <Tab label="Nominee" />
          <Tab label="Profile Settings" />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
          {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
          {loading ? <Alert severity="info" sx={{ mb: 2 }}>Loading details...</Alert> : null}

          {tab === 0 ? (
            <Box>
              {kycMeta.verified ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  KYC verified{kycMeta.verified_at ? ` on ${new Date(kycMeta.verified_at).toLocaleString()}` : ""}.
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  KYC pending verification. Please ensure your details are correct.
                </Alert>
              )}
              {locked ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Your KYC is verified and locked. To modify details, raise a Support request for KYC re-verification.
                  <Box sx={{ mt: 1 }}>
                    <Button variant="outlined" size="small" onClick={() => navigate("/user/support")}>
                      Open Support Portal
                    </Button>
                  </Box>
                </Alert>
              ) : null}

              <Box component="form" onSubmit={saveKYC}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" name="bank_name" label="Bank Name" value={kycForm.bank_name} onChange={(e) => setKycForm((f) => ({ ...f, bank_name: e.target.value }))} required />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" name="bank_account_number" label="Bank Account Number" value={kycForm.bank_account_number} onChange={(e) => setKycForm((f) => ({ ...f, bank_account_number: e.target.value }))} inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }} required />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" name="ifsc_code" label="IFSC Code" value={kycForm.ifsc_code} onChange={(e) => setKycForm((f) => ({ ...f, ifsc_code: e.target.value }))} inputProps={{ style: { textTransform: "uppercase" }, maxLength: 11 }} helperText="Example: HDFC0001234" required />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth size="small" name="aadhaar_digilocker_url" label="Aadhaar DigiLocker URL (optional)" value={kycForm.aadhaar_digilocker_url} onChange={(e) => setKycForm((f) => ({ ...f, aadhaar_digilocker_url: e.target.value }))} placeholder="https://digilocker.gov.in/..." helperText="Paste your DigiLocker share link or Aadhaar proof URL (optional)" />
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button type="submit" variant="contained" disabled={saving || loading || locked}>
                        {saving ? "Saving..." : "Save KYC"}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Box>
              {kycMeta.updated_at ? (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
                  Last updated: {new Date(kycMeta.updated_at).toLocaleString()}
                </Typography>
              ) : null}
            </Box>
          ) : null}

          {tab === 1 ? (
            <Box>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Nominee Details</Typography>
              <Box component="form" onSubmit={saveNominee}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Nominee Name" value={nomineeForm.name} onChange={(e) => setNomineeForm((f) => ({ ...f, name: e.target.value }))} required />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Relationship" value={nomineeForm.relationship} onChange={(e) => setNomineeForm((f) => ({ ...f, relationship: e.target.value }))} placeholder="Spouse, Father, Mother..." />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Phone" value={nomineeForm.phone} onChange={(e) => setNomineeForm((f) => ({ ...f, phone: e.target.value }))} inputProps={{ inputMode: "tel" }} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Share %" type="number" value={nomineeForm.share_percent} onChange={(e) => setNomineeForm((f) => ({ ...f, share_percent: e.target.value }))} inputProps={{ min: 0, max: 100 }} />
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {nomineeForm.id ? (
                        <Button type="button" variant="text" onClick={() => setNomineeForm(emptyNominee)} disabled={saving}>
                          Cancel Edit
                        </Button>
                      ) : null}
                      <Button type="submit" variant="contained" disabled={saving || loading}>
                        {saving ? "Saving..." : nomineeForm.id ? "Update Nominee" : "Add Nominee"}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="caption" color="text.secondary">
                Total allocated share: {nomineeTotal(nominees, null)}%
              </Typography>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {nominees.length === 0 ? (
                  <Alert severity="info">No nominee added yet.</Alert>
                ) : (
                  nominees.map((row) => (
                    <Paper key={row.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
                        <Box>
                          <Typography sx={{ fontWeight: 800 }}>{row.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.relationship || "Relationship not set"} {row.phone ? `- ${row.phone}` : ""} - Share {Number(row.share_percent || 0)}%
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" onClick={() => editNominee(row)}>
                            Edit
                          </Button>
                          <Button size="small" color="error" variant="outlined" onClick={() => deleteNominee(row)}>
                            Delete
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))
                )}
              </Stack>
            </Box>
          ) : null}

          {tab === 2 ? (
            <Box>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Profile Settings</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Name and email are saved on your user account and will show in the admin Team Consumers table after refresh.
              </Alert>
              <Box component="form" onSubmit={saveProfile}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Name" value={profileForm.full_name} onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))} required />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField fullWidth size="small" label="Email" type="email" value={profileForm.email} onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))} />
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button type="submit" variant="contained" disabled={saving || loading}>
                        {saving ? "Saving..." : "Save Profile"}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          ) : null}
        </Box>
      </Paper>
    </Container>
  );
}
