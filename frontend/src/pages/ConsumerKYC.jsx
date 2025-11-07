import React, { useEffect, useMemo, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Stack,
  Alert,
  Grid,
} from "@mui/material";
import API from "../api/api";
import LOGO from "../assets/TRIKONEKT.png";

export default function ConsumerKYC() {
  const storedUser = useMemo(() => {
    try {
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);
  const displayName = storedUser?.full_name || storedUser?.username || "Consumer";

  const [form, setForm] = useState({
    bank_name: "",
    bank_account_number: "",
    ifsc_code: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [meta, setMeta] = useState({ verified: false, verified_at: null, updated_at: null });

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    const { bank_name, bank_account_number, ifsc_code } = form;
    if (!bank_name.trim()) {
      setError("Bank name is required.");
      return false;
    }
    const acc = bank_account_number.trim();
    if (!acc || acc.length < 6) {
      setError("Enter a valid bank account number.");
      return false;
    }
    const ifsc = ifsc_code.trim().toUpperCase();
    // Standard IFSC: 4 letters + 0 + 6 alphanumerics
    const ifscRe = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
    if (!ifscRe.test(ifsc)) {
      setError("Enter a valid IFSC code (e.g., HDFC0001234).");
      return false;
    }
    setError("");
    return true;
  };

  const loadKYC = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      // GET /accounts/kyc/me/
      const res = await API.get("/accounts/kyc/me/");
      const data = res?.data || {};
      setForm({
        bank_name: data.bank_name || "",
        bank_account_number: data.bank_account_number || "",
        ifsc_code: data.ifsc_code || "",
      });
      setMeta({
        verified: Boolean(data.verified),
        verified_at: data.verified_at || null,
        updated_at: data.updated_at || null,
      });
    } catch (e) {
      setError("Failed to load KYC details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKYC();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSaving(true);
      setMessage("");
      // PUT /accounts/kyc/me/
      const payload = {
        bank_name: form.bank_name.trim(),
        bank_account_number: form.bank_account_number.trim(),
        ifsc_code: form.ifsc_code.trim().toUpperCase(),
      };
      const res = await API.put("/accounts/kyc/me/", payload);
      const data = res?.data || {};
      setMessage("KYC details saved.");
      setMeta({
        verified: Boolean(data.verified),
        verified_at: data.verified_at || null,
        updated_at: data.updated_at || null,
      });
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : "Failed to save KYC.");
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "#f7f9fb" }}>
      <AppBar position="fixed" sx={{ backgroundColor: "#0C2D48" }}>
        <Toolbar>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box component="img" src={LOGO} alt="Trikonekt" sx={{ height: 36 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}></Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="body2">{displayName}</Typography>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
        <Toolbar />

        <Container maxWidth="sm" sx={{ px: 0, ml: 0, mr: "auto" }}>
          <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 2 }}>
              Bank KYC
            </Typography>

            {meta.verified ? (
              <Alert severity="success" sx={{ mb: 2 }}>
                KYC verified{meta.verified_at ? ` on ${new Date(meta.verified_at).toLocaleString()}` : ""}.
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mb: 2 }}>
                KYC pending verification. Please ensure your details are correct.
              </Alert>
            )}
            {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

            <Box component="form" onSubmit={onSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    name="bank_name"
                    label="Bank Name"
                    value={form.bank_name}
                    onChange={onChange}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    name="bank_account_number"
                    label="Bank Account Number"
                    value={form.bank_account_number}
                    onChange={onChange}
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    name="ifsc_code"
                    label="IFSC Code"
                    value={form.ifsc_code}
                    onChange={onChange}
                    inputProps={{ style: { textTransform: "uppercase" }, maxLength: 11 }}
                    helperText="Example: HDFC0001234"
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={saving || loading}
                      sx={{ backgroundColor: "#145DA0", "&:hover": { backgroundColor: "#0C4B82" } }}
                    >
                      {saving ? "Saving..." : "Save KYC"}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </Box>

            {meta.updated_at ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
                Last updated: {new Date(meta.updated_at).toLocaleString()}
              </Typography>
            ) : null}
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
