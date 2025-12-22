import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Stack,
  TextField,
  Button,
  Typography,
  InputAdornment,
  MenuItem,
} from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import NumbersIcon from "@mui/icons-material/Numbers";
import NotesIcon from "@mui/icons-material/Notes";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";

/**
 * AssignCouponsForm
 * - Modernized input fields with icons
 * - Used for:
 *    * variant="consumer"  -> Send E‑Coupons to Consumer (by Count)
 *    * variant="employee"  -> Distribute to Employee (by Count)
 *
 * Props:
 * - variant: "consumer" | "employee"
 * - onSubmit: async ({ username, count, notes, value }) => { message?: string }
 * - submitting?: boolean (optional external control)
 * - denomOptions?: Array<number|string>  (e.g., ["150","750","759"]) - optional
 * - availByDenom?: Record<string, number> { "150": 3, "750": 0, ... } - optional
 * - hideZeroDenoms?: boolean (default false) -> if true, hide 0-availability denominations from dropdown
 */
export default function AssignCouponsForm({
  variant = "consumer",
  onSubmit,
  submitting = false,
  denomOptions = [],
  availByDenom = {},
  hideZeroDenoms = false,
}) {
  // if denomOptions provided, use a dropdown; otherwise fall back to numeric "Amount (optional)"
  const hasDenoms = Array.isArray(denomOptions) && denomOptions.length > 0;

  const [form, setForm] = useState({
    username: "",
    count: 1,
    amount: "", // used only when hasDenoms === false
    notes: "",
  });
  const [selectedDenom, setSelectedDenom] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // pick first denomination; prefer one that has availability > 0
  useEffect(() => {
    if (!hasDenoms) return;
    const list = denomOptions.map((d) => String(d));
    if (!list.length) return;
    const firstWithStock =
      list.find((d) => (availByDenom?.[String(d)] ?? 0) > 0) ?? list[0];
    setSelectedDenom(firstWithStock);
  }, [hasDenoms, JSON.stringify(denomOptions), JSON.stringify(availByDenom)]);

  // availability for the selected denomination
  const selectedAvail = useMemo(() => {
    if (!hasDenoms || !selectedDenom) return null;
    const k = String(selectedDenom);
    const n = Number(availByDenom?.[k] ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, [hasDenoms, selectedDenom, availByDenom]);

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

    // if using dropdown, ensure a denomination is chosen and available
    if (hasDenoms) {
      if (!selectedDenom) {
        try {
          alert("Choose a denomination.");
        } catch {}
        return;
      }
      if (selectedAvail !== null && selectedAvail >= 0 && c > selectedAvail) {
        try {
          alert(
            `Requested count exceeds availability for ₹${selectedDenom}. Available: ${selectedAvail}.`
          );
        } catch {}
        return;
      }
    }

    // Determine denomination to send
    let valueNum = null;
    if (hasDenoms) {
      const n = Number(selectedDenom);
      if (Number.isFinite(n) && n > 0) valueNum = n;
    } else {
      // fallback: optional free-amount field
      try {
        const n = Number(form.amount);
        if (Number.isFinite(n) && n > 0) valueNum = n;
      } catch {}
    }

    setMsg("");
    try {
      setLoading(true);
      if (typeof onSubmit === "function") {
        const payload = { username: u, count: c, notes: form.notes || "" };
        if (valueNum) payload.value = valueNum;
        const res = await onSubmit(payload);
        const m = res?.message || "Assigned successfully.";
        setMsg(m);
        setForm((s) => ({ ...s, count: 1, amount: "", notes: "" }));
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

  const denomItems = useMemo(() => {
    if (!hasDenoms) return [];
    const raw = denomOptions.map((d) => String(d));
    return raw
      .filter((d) =>
        hideZeroDenoms ? (availByDenom?.[String(d)] ?? 0) > 0 : true
      )
      .map((d) => {
        const a = Number(availByDenom?.[String(d)] ?? 0);
        return {
          value: d,
          label: `₹${d}${Number.isFinite(a) ? ` (${a} available)` : ""}`,
          disabled: !hideZeroDenoms && a <= 0,
        };
      });
  }, [hasDenoms, denomOptions, availByDenom, hideZeroDenoms]);

  const disableSubmit =
    busy ||
    (hasDenoms &&
      selectedAvail !== null &&
      selectedAvail >= 0 &&
      Number(form.count || 0) > selectedAvail);

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

          {hasDenoms ? (
            <TextField
              select
              size="small"
              label="Denomination"
              value={selectedDenom}
              onChange={(e) => setSelectedDenom(String(e.target.value))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CurrencyRupeeIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            >
              {denomItems.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              size="small"
              label="Amount (optional)"
              type="number"
              inputProps={{ min: 1 }}
              value={form.amount}
              onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CurrencyRupeeIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          )}

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

        {hasDenoms && selectedDenom ? (
          <Typography variant="caption" color="text.secondary">
            Selected: ₹{selectedDenom}
            {selectedAvail !== null && selectedAvail >= 0
              ? ` — ${selectedAvail} available`
              : ""}
          </Typography>
        ) : null}

        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant={variant === "employee" ? "outlined" : "contained"}
            onClick={handleSubmit}
            disabled={disableSubmit}
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
