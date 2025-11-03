import React, { useMemo, useState, useEffect } from "react";
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
} from "@mui/material";
import API from "../api/api";
import LOGO from "../assets/TRIKONEKT.png";

export default function RedeemCoupon() {
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
    coupon_code: "",
    pincode: "",
    notes: "",
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [mySubs, setMySubs] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [errorSubs, setErrorSubs] = useState("");

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setFile(null);
      return;
    }
    // optional: allow images and pdf as proof
    const ct = f.type || "";
    if (!(ct.startsWith("image/") || ct === "application/pdf")) {
      alert("Only image or PDF files are allowed as proof.");
      e.target.value = null;
      return;
    }
    setFile(f);
  };

  const loadMySubmissions = async () => {
    try {
      setLoadingSubs(true);
      setErrorSubs("");
      const res = await API.get("/coupons/submissions/my/");
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setMySubs(arr || []);
    } catch (e) {
      setErrorSubs("Failed to load your submissions.");
      setMySubs([]);
    } finally {
      setLoadingSubs(false);
    }
  };

  useEffect(() => {
    loadMySubmissions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.coupon_code || !form.pincode) {
      alert("Coupon code and Pincode are required.");
      return;
    }
    if (!file) {
      alert("Please upload a proof image or PDF.");
      return;
    }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append("coupon_code", String(form.coupon_code).trim());
      fd.append("pincode", String(form.pincode).trim());
      if (form.notes) fd.append("notes", String(form.notes).trim());
      fd.append("file", file);

      await API.post("/coupons/submissions/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Coupon submitted for redemption. Awaiting approvals.");
      setForm({ coupon_code: "", pincode: "", notes: "" });
      setFile(null);
      await loadMySubmissions();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        (err?.response?.data ? JSON.stringify(err.response.data) : "Submission failed");
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (s) => {
    const x = String(s || "").toUpperCase();
    switch (x) {
      case "SUBMITTED":
        return "Pending Employee Approval";
      case "EMPLOYEE_APPROVED":
        return "Pending Agency Approval";
      case "AGENCY_APPROVED":
        return "Redeemed";
      case "REJECTED":
        return "Rejected";
      default:
        return x || "Unknown";
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
              Redeem Lucky Coupon
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
              Enter your physical coupon code and upload a proof (image/PDF). Your request will be verified by the Employee and Agency.
            </Typography>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  name="coupon_code"
                  label="Coupon Code"
                  value={form.coupon_code}
                  onChange={onChange}
                  required
                />
                <TextField
                  fullWidth
                  name="pincode"
                  label="Pincode"
                  value={form.pincode}
                  onChange={onChange}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  required
                />
                <TextField
                  fullWidth
                  name="notes"
                  label="Notes (optional)"
                  value={form.notes}
                  onChange={onChange}
                  multiline
                  minRows={2}
                />
                <Button variant="outlined" component="label" fullWidth>
                  {file ? `Selected: ${file.name}` : "Upload Proof (Image or PDF)"}
                  <input type="file" accept="image/*,application/pdf" hidden onChange={onFileChange} />
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting}
                  sx={{ backgroundColor: "#145DA0", "&:hover": { backgroundColor: "#0C4B82" } }}
                >
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </Stack>
            </Box>
          </Paper>

          <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mt: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
              My Coupon Redemptions
            </Typography>
            {loadingSubs ? (
              <Typography variant="body2">Loading...</Typography>
            ) : errorSubs ? (
              <Alert severity="error">{errorSubs}</Alert>
            ) : (mySubs || []).length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                No submissions yet.
              </Typography>
            ) : (
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {(mySubs || []).map((s) => (
                  <li key={s.id} style={{ marginBottom: 8 }}>
                    <Typography variant="body2">
                      <strong>Code:</strong> {s.coupon_code} — <strong>Status:</strong> {statusLabel(s.status)}{" "}
                      {s.created_at ? `— ${new Date(s.created_at).toLocaleString()}` : ""}
                    </Typography>
                  </li>
                ))}
              </Box>
            )}
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}
