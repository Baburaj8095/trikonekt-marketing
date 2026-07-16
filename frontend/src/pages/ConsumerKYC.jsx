import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Chip,
  CircularProgress
} from "@mui/material";
import {
  CheckCircle,
  Pending,
  Cancel,
  ArrowForward,
  Badge,
  AccountBalance,
  Groups,
  ManageAccounts
} from "@mui/icons-material";
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

  // DigiLocker KYC state
  const [dlStatus, setDlStatus] = useState("NOT_STARTED"); // NOT_STARTED, IN_PROGRESS, PENDING, VERIFIED, REJECTED
  const [dlProfile, setDlProfile] = useState(null);
  const [dlLoading, setDlLoading] = useState(false);

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

  const locked = dlStatus === "VERIFIED" || (kycMeta.verified && !kycMeta.can_submit_kyc);
  const displayName = profileForm.full_name || storedUser?.username || "Consumer";

  const clearAlerts = () => {
    setError("");
    setMessage("");
  };

  const fetchDlStatus = async () => {
    try {
      setDlLoading(true);
      const res = await API.get("/kyc/status");
      if (res?.data?.status) {
        const status = res.data.status;
        setDlStatus(status);
        if (status === "PENDING" || status === "VERIFIED" || status === "REJECTED") {
          const profileRes = await API.get("/kyc/profile");
          if (profileRes?.data) {
            setDlProfile(profileRes.data);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch DigiLocker status", err);
    } finally {
      setDlLoading(false);
    }
  };

  const startDigiLockerKyc = async () => {
    try {
      setSaving(true);
      clearAlerts();
      const res = await API.post("/kyc/start");
      if (res?.data?.authorization_url) {
        window.location.href = res.data.authorization_url;
      } else {
        setError("Failed to generate DigiLocker verification link.");
      }
    } catch (err) {
      setError("Failed to initiate DigiLocker KYC: " + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
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
    try {
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
    } catch (_) {}
  };

  const loadNominees = async () => {
    try {
      const res = await API.get("/accounts/nominees/");
      const data = res?.data || [];
      setNominees(Array.isArray(data) ? data : data.results || []);
    } catch (_) {}
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      clearAlerts();
      await Promise.all([loadProfile(), loadKYC(), loadNominees(), fetchDlStatus()]);
    } catch (_) {
      setError("Failed to load account details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callback = params.get("kyc_callback");
    if (callback === "success") {
      setMessage("DigiLocker verification completed! Your profile is pending admin approval.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (callback === "error") {
      const errorMsg = params.get("error") || "Unknown error";
      setError("DigiLocker verification failed: " + decodeURIComponent(errorMsg));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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
      setMessage("Bank details saved successfully.");
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
        (err?.response?.data ? JSON.stringify(err.response.data) : "Failed to save bank details.");
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
      setMessage("Profile settings updated successfully.");
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
        setMessage("Nominee updated successfully.");
      } else {
        await API.post("/accounts/nominees/", payload);
        setMessage("Nominee added successfully.");
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
      setMessage("Nominee deleted successfully.");
      if (String(nomineeForm.id || "") === String(row.id)) setNomineeForm(emptyNominee);
      await loadNominees();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to delete nominee.");
    } finally {
      setSaving(false);
    }
  };

  // Render KYC Status Header Card
  const renderStatusHeader = () => {
    const statusConfig = {
      NOT_STARTED: {
        label: "KYC Unverified",
        color: "error",
        icon: <Cancel />,
        desc: "Please verify your identity using DigiLocker to unlock wallet withdrawals and uplink payouts."
      },
      IN_PROGRESS: {
        label: "Verification In Progress",
        color: "warning",
        icon: <Pending />,
        desc: "You have started the DigiLocker verification. Please complete the flow."
      },
      PENDING: {
        label: "Pending Admin Approval",
        color: "warning",
        icon: <Pending />,
        desc: "Aadhaar details fetched successfully. Admin moderation is pending."
      },
      VERIFIED: {
        label: "KYC Verified",
        color: "success",
        icon: <CheckCircle />,
        desc: "Congratulations! Your identity is verified. Wallet withdrawals and withdrawals payouts are enabled."
      },
      REJECTED: {
        label: "KYC Rejected",
        color: "error",
        icon: <Cancel />,
        desc: `Verification rejected. Remarks: ${dlProfile?.remarks || "Please try again."}`
      }
    };

    const cfg = statusConfig[dlStatus] || statusConfig.NOT_STARTED;

    return (
      <Card sx={{ mb: 3, borderLeft: 6, borderColor: `${cfg.color}.main`, background: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)" }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Chip icon={cfg.icon} label={cfg.label} color={cfg.color} variant="filled" sx={{ fontWeight: 800 }} />
                {dlStatus === "VERIFIED" && <Chip label="Withdrawals Enabled" color="success" size="small" variant="outlined" />}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {cfg.desc}
              </Typography>
            </Box>
            {dlStatus === "VERIFIED" && dlProfile?.verified_at && (
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Verified On: {new Date(dlProfile.verified_at).toLocaleDateString()}
                </Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Container maxWidth="md" sx={{ px: { xs: 0, md: 2 }, py: { xs: 1, md: 2 } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: "#0C2D48" }}>
            KYC & Profile Settings
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Manage identity verification, nominee details, and bank account setup
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Logged in as: {displayName}
        </Typography>
      </Box>

      {renderStatusHeader()}

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
          <Tab icon={<Badge sx={{ mr: 1, fontSize: 18 }} />} iconPosition="start" label="Identity (DigiLocker)" />
          <Tab icon={<AccountBalance sx={{ mr: 1, fontSize: 18 }} />} iconPosition="start" label="Bank Details" />
          <Tab icon={<Groups sx={{ mr: 1, fontSize: 18 }} />} iconPosition="start" label="Nominees" />
          <Tab icon={<ManageAccounts sx={{ mr: 1, fontSize: 18 }} />} iconPosition="start" label="Profile Settings" />
        </Tabs>

        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {loading || dlLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : null}

          {/* Tab 0: DigiLocker Identity */}
          {tab === 0 && !loading && !dlLoading && (
            <Box>
              {(dlStatus === "NOT_STARTED" || dlStatus === "REJECTED" || dlStatus === "IN_PROGRESS") && (
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: "center", bgcolor: "rgba(240, 244, 248, 0.5)" }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, color: "#10316B" }}>
                    Verify Identity via DigiLocker
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxW: 500, mx: "auto" }}>
                    DigiLocker is a secure cloud platform by the Government of India for document verification. You will be redirected to DigiLocker to authenticate.
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    color="primary"
                    onClick={startDigiLockerKyc}
                    disabled={saving}
                    endIcon={<ArrowForward />}
                    sx={{ borderRadius: 2, px: 4, py: 1.25, fontWeight: 700 }}
                  >
                    {saving ? "Redirecting..." : "Start DigiLocker Verification"}
                  </Button>
                </Paper>
              )}

              {(dlStatus === "PENDING" || dlStatus === "VERIFIED" || dlStatus === "REJECTED") && dlProfile && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
                    Aadhaar Identity Details
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={3} sx={{ display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
                        {dlProfile.photo ? (
                          <Avatar
                            src={`data:image/jpeg;base64,${dlProfile.photo}`}
                            variant="rounded"
                            sx={{ width: 110, height: 130, border: "2px solid #ccc", boxShadow: 1 }}
                          />
                        ) : (
                          <Avatar variant="rounded" sx={{ width: 110, height: 130, bgcolor: "primary.main" }}>
                            {dlProfile.name ? dlProfile.name.charAt(0) : "U"}
                          </Avatar>
                        )}
                      </Grid>
                      <Grid item xs={12} sm={9}>
                        <Grid container spacing={1.5}>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">Name (as per Aadhaar)</Typography>
                            <Typography sx={{ fontWeight: 700 }}>{dlProfile.name}</Typography>
                          </Grid>
                          <Grid item xs={6} md={4}>
                            <Typography variant="caption" color="text.secondary">Date of Birth</Typography>
                            <Typography sx={{ fontWeight: 600 }}>{dlProfile.dob}</Typography>
                          </Grid>
                          <Grid item xs={6} md={4}>
                            <Typography variant="caption" color="text.secondary">Gender</Typography>
                            <Typography sx={{ fontWeight: 600 }}>{dlProfile.gender === "M" ? "Male" : dlProfile.gender === "F" ? "Female" : dlProfile.gender}</Typography>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="caption" color="text.secondary">Aadhaar (Last 4 Digits)</Typography>
                            <Typography sx={{ fontWeight: 600 }}>xxxx-xxxx-{dlProfile.aadhaarLast4 || "8095"}</Typography>
                          </Grid>
                          {dlProfile.email && (
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="text.secondary">DigiLocker Email</Typography>
                              <Typography sx={{ fontWeight: 600 }}>{dlProfile.email}</Typography>
                            </Grid>
                          )}
                          {dlProfile.mobile && (
                            <Grid item xs={12} md={6}>
                              <Typography variant="caption" color="text.secondary">DigiLocker Mobile</Typography>
                              <Typography sx={{ fontWeight: 600 }}>{dlProfile.mobile}</Typography>
                            </Grid>
                          )}
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary">Address</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{dlProfile.address}</Typography>
                          </Grid>
                        </Grid>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Issued Documents list */}
                  {dlProfile.issuedDocumentsJson && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                        Linked Issued Documents
                      </Typography>
                      <Paper variant="outlined" sx={{ borderRadius: 2 }}>
                        <List dense>
                          {(() => {
                            try {
                              const docs = JSON.parse(dlProfile.issuedDocumentsJson);
                              const items = docs?.items || [];
                              if (items.length === 0) return <ListItem><ListItemText primary="No issued documents linked." /></ListItem>;
                              return items.map((doc, idx) => (
                                <ListItem key={idx} divider={idx < items.length - 1}>
                                  <ListItemText
                                    primary={doc.name}
                                    secondary={`URI: ${doc.uri} | Type: ${doc.type || "Document"}`}
                                    primaryTypographyProps={{ fontWeight: 700 }}
                                  />
                                </ListItem>
                              ));
                            } catch {
                              return <ListItem><ListItemText primary="Could not parse linked documents." /></ListItem>;
                            }
                          })()}
                        </List>
                      </Paper>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Tab 1: Bank KYC */}
          {tab === 1 && !loading && (
            <Box component="form" onSubmit={saveKYC}>
              <Box component="div" sx={{ mb: 2 }}>
                {kycMeta.verified ? (
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Bank account details are verified and locked.
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mb: 1 }}>
                    Please enter the bank details where you want to receive wallet withdrawals.
                  </Alert>
                )}
                {locked ? (
                  <Alert severity="warning">
                    Your KYC is locked. Raise a Support ticket to modify bank details.
                  </Alert>
                ) : null}
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth size="small" name="bank_name" label="Bank Name" value={kycForm.bank_name} onChange={(e) => setKycForm((f) => ({ ...f, bank_name: e.target.value }))} disabled={locked} required />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth size="small" name="bank_account_number" label="Bank Account Number" value={kycForm.bank_account_number} onChange={(e) => setKycForm((f) => ({ ...f, bank_account_number: e.target.value }))} disabled={locked} inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }} required />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth size="small" name="ifsc_code" label="IFSC Code" value={kycForm.ifsc_code} onChange={(e) => setKycForm((f) => ({ ...f, ifsc_code: e.target.value }))} disabled={locked} inputProps={{ style: { textTransform: "uppercase" }, maxLength: 11 }} helperText="Example: HDFC0001234" required />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" name="aadhaar_digilocker_url" label="Secondary Verification Link (Optional)" value={kycForm.aadhaar_digilocker_url} onChange={(e) => setKycForm((f) => ({ ...f, aadhaar_digilocker_url: e.target.value }))} disabled={locked} placeholder="https://..." helperText="Any additional verification link or proof" />
                </Grid>
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button type="submit" variant="contained" disabled={saving || loading || locked}>
                      {saving ? "Saving..." : "Save Bank Details"}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* Tab 2: Nominee */}
          {tab === 2 && !loading && (
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
                      {nomineeForm.id && (
                        <Button type="button" variant="text" onClick={() => setNomineeForm(emptyNominee)} disabled={saving}>
                          Cancel Edit
                        </Button>
                      )}
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
                  <Alert severity="info">No nominees added yet.</Alert>
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
          )}

          {/* Tab 3: Profile Settings */}
          {tab === 3 && !loading && (
            <Box>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Profile Settings</Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Name and email are saved on your user account and will display in the admin console.
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
          )}
        </Box>
      </Paper>
    </Container>
  );
}
