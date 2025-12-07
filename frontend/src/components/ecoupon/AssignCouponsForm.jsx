import React, { useState } from "react";
import {
  Box,
  Stack,
  TextField,
  Button,
  Typography,
  InputAdornment,
} from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import NumbersIcon from "@mui/icons-material/Numbers";
import NotesIcon from "@mui/icons-material/Notes";

/**
 * AssignCouponsForm
 * - Modernized input fields with icons
 * - Used for:
 *    * variant="consumer"  -> Send E‑Coupons to Consumer (by Count)
 *    * variant="employee"  -> Distribute to Employee (by Count)
 *
 * Props:
 * - variant: "consumer" | "employee"
 * - onSubmit: async ({ username, count, notes }) => { message?: string }
 * - submitting?: boolean (optional external control)
 */
export default function AssignCouponsForm({ variant = "consumer", onSubmit, submitting = false }) {
  const [form, setForm] = useState({ username: "", count: 1, notes: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const label =
    variant === "employee" ? "Employee Username" : "Consumer Username";
  const buttonLabel =
    variant === "employee" ? "Assign to Employee" : "Assign to Consumer";

  const handleSubmit = async () => {
    const u = (form.username || "").trim();
    const c = parseInt(form.count || "0", 10);
    if (!u || !c || c <= 0) {
      try {
        alert(`Enter ${label.toLowerCase()} and a valid count (>0).`);
      } catch {}
      return;
    }
    setMsg("");
    try {
      setLoading(true);
      if (typeof onSubmit === "function") {
        const res = await onSubmit({ username: u, count: c, notes: form.notes || "" });
        const m = res?.message || "Assigned successfully.";
        setMsg(m);
        setForm((s) => ({ ...s, count: 1, notes: "" }));
      }
    } catch (e) {
      const err = e?.response?.data;
      const m =
        (typeof err === "string"
          ? err
          : err?.detail || JSON.stringify(err || {})) || "Assignment failed.";
      try {
        alert(m);
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const busy = submitting || loading;

  return (
    <Box>
      <Stack spacing={1.5}>
        <TextField
          size="small"
          label={label}
          value={form.username}
          onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonOutlineIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            size="small"
            label="Count"
            type="number"
            inputProps={{ min: 1 }}
            value={form.count}
            onChange={(e) => setForm((s) => ({ ...s, count: e.target.value }))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <NumbersIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            size="small"
            label="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <NotesIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant={variant === "employee" ? "outlined" : "contained"}
            onClick={handleSubmit}
            disabled={busy}
            sx={{ fontWeight: 800 }}
          >
            {busy ? "Submitting..." : buttonLabel}
          </Button>
          {msg ? (
            <Typography variant="caption" color="text.secondary">
              {msg}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}
