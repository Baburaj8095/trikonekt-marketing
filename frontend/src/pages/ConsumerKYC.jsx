import React, { useEffect, useMemo, useState } from "react";
import {
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

export default function ConsumerKYC() {
  const storedUser = useMemo(() => {
    try {
      const ls =
        localStorage.getItem("user_user") ||
        sessionStorage.getItem("user_user") ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user");
      const parsed = ls ? JSON.parse(ls) : {};
      return parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object" ? parsed.user : parsed;
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
    if (!String(bank_name || "").trim()) {
      setError("Bank name is required.");
      return false;
    }
    const acc = String(bank_account_number || "").trim();
    if (!acc || acc.length < 6) {
      setError("Enter a valid bank account number.");
      return false;
    }
    const ifsc = String(ifsc_code || "").trim().toUpperCase();
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
      const payload = {
        bank_name: String(form.bank_name || "").trim(),
        bank_account_number: String(form.bank_account_number || "").trim(),
        ifsc_code: String(form.ifsc_code || "").trim().toUpperCase(),
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
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ px: { xs: 0, md: 2 }, py: { xs: 1, md: 2 } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48" }}>
          Bank KYC
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {displayName}
        </Typography>
      </Box>

      <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
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
  );
}
