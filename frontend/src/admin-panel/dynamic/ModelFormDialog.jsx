import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  Typography,
} from "@mui/material";
import API from "../api/client";

/**
 * Generic Create/Edit dialog based on field metadata from /api/admin/admin-meta/.
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - route: string (e.g., "/admin/dynamic/accounts/customuser/")
 * - fields: Array<{ name, type, read_only, required, label, choices? }>
 * - record: object | null (if present, edit mode; else create)
 * - onSaved: () => void (invoked after successful save)
 * - title?: string
 */
export default function ModelFormDialog({
  open,
  onClose,
  route,
  fields = [],
  record = null,
  onSaved,
  title,
}) {
  const [values, setValues] = React.useState({});
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const init = {};
    for (const f of fields) {
      // Prefer existing value from record; else null for optional
      init[f.name] = record && record[f.name] !== undefined ? record[f.name] : (f.required ? "" : "");
    }
    setValues(init);
    setErrors({});
  }, [record, fields, open]);

  const handleChange = (name, v) => {
    setValues((s) => ({ ...s, [name]: v }));
  };

  const isChoiceField = (f) => Array.isArray(f.choices) && f.choices.length > 0;
  const isBooleanField = (f) =>
    ["BooleanField", "NullBooleanField"].includes(f.type) ||
    (typeof values[f.name] === "boolean");
  const isNumeric = (f) =>
    ["IntegerField", "BigIntegerField", "FloatField", "DecimalField", "AutoField"].includes(f.type);

  async function submit() {
    setSaving(true);
    setErrors({});
    try {
      const payload = {};
      for (const f of fields) {
        if (f.read_only) continue;
        let v = values[f.name];
        if (isNumeric(f) && v !== "" && v !== null && v !== undefined) {
          if (f.type === "FloatField" || f.type === "DecimalField") {
            const n = Number(v);
            if (!Number.isNaN(n)) v = n;
          } else {
            const n = parseInt(v, 10);
            if (!Number.isNaN(n)) v = n;
          }
        }
        payload[f.name] = v;
      }

      const isEdit = record && (record.id || record.pk);
      const url = isEdit ? `${route}${record.id || record.pk}/` : route;
      const method = isEdit ? "patch" : "post";

      await API.request({ url, method, data: payload });
      try {
        onSaved && onSaved();
      } catch (_) {}
      onClose && onClose();
    } catch (e) {
      // Map DRF validation errors { field: ["err"] }
      const data = e?.response?.data || {};
      const mapped = {};
      for (const [k, v] of Object.entries(data)) {
        mapped[k] = Array.isArray(v) ? v.join(", ") : String(v);
      }
      setErrors(mapped);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {title || (record ? "Edit" : "Create")}
        <Typography variant="caption" sx={{ ml: 1, color: "text.secondary" }}>
          {route}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 2,
            pt: 1,
          }}
        >
          {fields
            .filter((f) => f.name !== "id" && f.name !== "pk")
            .map((f) => {
              const val = values[f.name];
              const label = f.label || f.name;
              const readOnly = !!f.read_only;

              if (isBooleanField(f)) {
                return (
                  <FormControlLabel
                    key={f.name}
                    control={
                      <Switch
                        checked={!!val}
                        onChange={(e) => handleChange(f.name, e.target.checked)}
                        disabled={readOnly}
                      />
                    }
                    label={label}
                  />
                );
              }

              if (isChoiceField(f)) {
                return (
                  <TextField
                    key={f.name}
                    select
                    label={label}
                    value={val ?? ""}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                    disabled={readOnly}
                    required={!!f.required}
                    error={!!errors[f.name]}
                    helperText={errors[f.name] || " "}
                    size="small"
                  >
                    <MenuItem value="">
                      <em>—</em>
                    </MenuItem>
                    {f.choices.map(([v, text]) => (
                      <MenuItem key={String(v)} value={v}>
                        {text}
                      </MenuItem>
                    ))}
                  </TextField>
                );
              }

              return (
                <TextField
                  key={f.name}
                  label={label}
                  value={val ?? ""}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  disabled={readOnly}
                  required={!!f.required}
                  error={!!errors[f.name]}
                  helperText={errors[f.name] || " "}
                  size="small"
                  type={isNumeric(f) ? "number" : "text"}
                />
              );
            })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} color="inherit">
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving} variant="contained">
          {record ? "Save" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
