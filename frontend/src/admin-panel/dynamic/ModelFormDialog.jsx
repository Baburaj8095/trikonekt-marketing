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
  const [formFields, setFormFields] = React.useState([]);
  const [formLoading, setFormLoading] = React.useState(false);

  // Resolve fields dynamically:
  // 1) Prefer backend OPTIONS schema (POST for create, PATCH/POST for edit)
  // 2) Fallback to provided props.fields
  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setFormLoading(true);
        const base = Array.isArray(fields) ? fields : [];
        const targetUrl = record && (record.id || record.pk) ? `${route}${record.id || record.pk}/` : route;
        let derived = [];
        try {
          const res = await API.options(targetUrl);
          const actions = res?.data?.actions || {};
          const actionSchema = record
            ? (actions.PATCH || actions.POST || actions.PUT || null)
            : (actions.POST || actions.PUT || actions.PATCH || null);
          if (actionSchema && typeof actionSchema === "object") {
            derived = Object.entries(actionSchema).map(([name, meta]) => {
              const t = String(meta?.type || "").toLowerCase();
              const choices = Array.isArray(meta?.choices)
                ? meta.choices.map((c) => [c.value, c.display_name || c.display || String(c.value)])
                : undefined;
              return {
                name,
                type: meta?.type || "",
                required: !!meta?.required,
                read_only: !!meta?.read_only,
                label: meta?.label || name,
                choices,
                widget: t.includes("file") ? "file" : undefined,
                help_text: meta?.help_text || "",
                default: meta?.default,
              };
            });
          }
        } catch {
          // ignore OPTIONS errors, fallback to provided fields
        }
        const finalFields = (derived && derived.length) ? derived : base;
        if (mounted) setFormFields(finalFields);
      } finally {
        if (mounted) setFormLoading(false);
      }
    }
    if (open && route) load();
    else setFormFields(Array.isArray(fields) ? fields : []);
    return () => { mounted = false; };
  }, [open, route, record, fields]);

  // Initialize values whenever record or resolved form fields change
  React.useEffect(() => {
    const init = {};
    for (const f of formFields) {
      if (record && record[f.name] !== undefined) {
        init[f.name] = record[f.name];
      } else if (f.default !== undefined) {
        init[f.name] = f.default;
      } else {
        init[f.name] = f.required ? "" : "";
      }
    }
    setValues(init);
    setErrors({});
  }, [record, formFields, open]);

  const handleChange = (name, v) => {
    setValues((s) => ({ ...s, [name]: v }));
  };

  const isChoiceField = (f) => Array.isArray(f.choices) && f.choices.length > 0;
  const isBooleanField = (f) => {
    const t = String(f.type || "").toLowerCase();
    return (
      ["booleanfield", "nullbooleanfield"].includes(t) ||
      t === "boolean" || t === "bool" ||
      typeof values[f.name] === "boolean"
    );
  };
  const isNumeric = (f) => {
    const t = String(f.type || "").toLowerCase();
    return (
      ["integerfield", "bigintegerfield", "floatfield", "decimalfield", "autofield", "smallintegerfield"].includes(t) ||
      t === "integer" || t === "number" || t === "float" || t === "decimal"
    );
  };
  const isFileField = (f) => {
    const t = String(f.type || "").toLowerCase();
    const w = String(f.widget || "").toLowerCase();
    return (
      ["imagefield", "filefield"].includes(t) ||
      t.includes("file") || t.includes("image") ||
      w === "file" || w.includes("file")
    );
  };

  // Detect FK (PrimaryKeyRelatedField) via configured lookups for this route/field
  const routeKey = React.useMemo(() => {
    try {
      const m = String(route || "").match(/admin\/dynamic\/([^/]+)\/([^/]+)\//);
      return m ? `${m[1]}/${m[2]}` : "";
    } catch {
      return "";
    }
  }, [route]);

  // Known FK lookups to render searchable dropdowns instead of raw text
  const FK_LOOKUPS = React.useMemo(
    () => ({
      "business/promomonthlypackage": {
        package: { route: "admin/dynamic/business/promopackage/", labelField: "name", valueField: "id" },
      },
      "business/promopackageproduct": {
        package: { route: "admin/dynamic/business/promopackage/", labelField: "name", valueField: "id" },
        product: { route: "admin/dynamic/market/product/", labelField: "name", valueField: "id" },
      },
    }),
    []
  );

  const getLookupConfig = (fieldName) =>
    (FK_LOOKUPS?.[routeKey] && FK_LOOKUPS[routeKey][fieldName]) ? FK_LOOKUPS[routeKey][fieldName] : null;

  const isRelationField = (f) => {
    const t = String(f.type || "");
    return t === "PrimaryKeyRelatedField" || !!getLookupConfig(f.name);
  };

  // Remote options state (per-FK field)
  const [remoteOptions, setRemoteOptions] = React.useState({});
  const [remoteLoading, setRemoteLoading] = React.useState({});

  const fetchRemoteOptions = React.useCallback(async (fieldName, query = "") => {
    const conf = getLookupConfig(fieldName);
    if (!conf || !conf.route) return;
    setRemoteLoading((s) => ({ ...s, [fieldName]: true }));
    try {
      const params = { page: 1, page_size: 50 };
      if (query && String(query).trim()) params.search = String(query).trim();
      const { data } = await API.get(conf.route, { params });
      const results = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
      const mapped = results.map((r) => {
        const val = r?.[conf.valueField];
        const label = r?.[conf.labelField] || r?.code || r?.repr || r?.__str__ || String(val);
        return { value: val, label };
      });
      setRemoteOptions((s) => ({ ...s, [fieldName]: mapped }));
    } catch {
      setRemoteOptions((s) => ({ ...s, [fieldName]: [] }));
    } finally {
      setRemoteLoading((s) => ({ ...s, [fieldName]: false }));
    }
  }, [getLookupConfig]);

  function inputType(f) {
    const t = String(f.type || "").toLowerCase();
    if (t.includes("password")) return "password";
    if (t.includes("email")) return "email";
    if (t.includes("url")) return "url";
    if (t.includes("date") && t.includes("time")) return "datetime-local";
    if (t.includes("datetime")) return "datetime-local";
    if (t.includes("date")) return "date";
    if (isNumeric(f)) return "number";
    return "text";
  }

  function isMultiline(f) {
    const t = String(f.type || "").toLowerCase();
    return t.includes("text") || t.includes("json");
  }

  // Helpers to coerce relation values to PK integers when possible
  const coerceRelationValue = (f, v) => {
    if (v === "" || v === null || v === undefined) return v;
    if (typeof v === "object" && v) {
      const id = v.id ?? v.value ?? v.pk;
      if (id !== undefined && id !== null) return id;
    }
    const s = String(v);
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    return v;
  };

  async function submit() {
    setSaving(true);
    setErrors({});
    try {
      const wantsForm =
        formFields.some((f) => isFileField(f)) ||
        Object.values(values).some((v) => v instanceof File);

      let dataToSend = null;

      if (wantsForm) {
        const form = new FormData();
        for (const f of formFields) {
          if (f.read_only) continue;
          let v = values[f.name];

          // On edit, omit empty to keep existing
          if (v === null || v === undefined || v === "") {
            if (!record) form.append(f.name, "");
            continue;
          }

          if (v instanceof File) {
            form.append(f.name, v);
            continue;
          }

          // Normalize numeric types
          if (isNumeric(f)) {
            if (f.type === "FloatField" || f.type === "DecimalField") {
              const n = Number(v);
              if (!Number.isNaN(n)) v = n;
            } else {
              const n = parseInt(v, 10);
              if (!Number.isNaN(n)) v = n;
            }
          }

          // Coerce relation PKs
          if (isRelationField(f)) {
            v = coerceRelationValue(f, v);
          }

          if (typeof v === "boolean") {
            form.append(f.name, v ? "true" : "false");
          } else {
            form.append(f.name, String(v));
          }
        }
        dataToSend = form;
      } else {
        const payload = {};
        const isEdit = record && (record.id || record.pk);
        for (const f of formFields) {
          if (f.read_only) continue;
          let v = values[f.name];

          // On edit, omit empty values to avoid overwriting with blanks (lets backend keep existing)
          if (isEdit && (v === "" || v === null || v === undefined)) {
            continue;
          }

          if (isNumeric(f) && v !== "" && v !== null && v !== undefined) {
            if (f.type === "FloatField" || f.type === "DecimalField") {
              const n = Number(v);
              if (!Number.isNaN(n)) v = n;
            } else {
              const n = parseInt(v, 10);
              if (!Number.isNaN(n)) v = n;
            }
          }

          if (isRelationField(f)) {
            v = coerceRelationValue(f, v);
          }

          payload[f.name] = v;
        }
        dataToSend = payload;
      }

      const isEdit = record && (record.id || record.pk);
      const url = isEdit ? `${route}${record.id || record.pk}/` : route;
      const method = isEdit ? "patch" : "post";

      await API.request({ url, method, data: dataToSend });
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
          {(formFields || [])
            .filter((f) => f.name !== "id" && f.name !== "pk")
            .map((f) => {
              const val = values[f.name];
              const label = f.label || f.name;
              const readOnly = !!f.read_only;
              const relation = isRelationField(f);

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

              if (isFileField(f)) {
                return (
                  <div key={f.name} style={{ display: "flex", flexDirection: "column" }}>
                    <label style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                      {label}{f.required ? " *" : ""}
                    </label>
                    <input
                      type="file"
                      onChange={(e) =>
                        handleChange(
                          f.name,
                          e.target.files && e.target.files[0] ? e.target.files[0] : null
                        )
                      }
                      disabled={readOnly}
                      accept={(String(f.type || "").toLowerCase().includes("image")) ? "image/*" : undefined}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                      }}
                    />
                    {record && typeof record[f.name] === "string" && record[f.name] ? (
                      <a
                        href={record[f.name]}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: "#0ea5e9", marginTop: 4, wordBreak: "break-all" }}
                      >
                        Current: {record[f.name]}
                      </a>
                    ) : null}
                    <span style={{ color: errors[f.name] ? "#dc2626" : "transparent", fontSize: 12, marginTop: 4 }}>
                      {errors[f.name] || "placeholder"}
                    </span>
                  </div>
                );
              }

              // If backend provides small explicit choices, use them (not for relations)
              if (isChoiceField(f) && !relation) {
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
                    helperText={errors[f.name] || f.help_text || " "}
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

              // Render relation dropdown for FK fields
              if (relation) {
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
                    helperText={errors[f.name] || f.help_text || " "}
                    size="small"
                    SelectProps={{ onOpen: () => fetchRemoteOptions(f.name) }}
                  >
                    <MenuItem value="">
                      <em>—</em>
                    </MenuItem>
                    {(remoteOptions[f.name] || []).map((opt) => (
                      <MenuItem key={String(opt.value)} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                );
              }

              // Default input
              return (
                <TextField
                  key={f.name}
                  label={label}
                  value={val ?? ""}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                  disabled={readOnly}
                  required={!!f.required}
                  error={!!errors[f.name]}
                  helperText={errors[f.name] || f.help_text || " "}
                  size="small"
                  type={inputType(f)}
                  multiline={isMultiline(f)}
                  minRows={isMultiline(f) ? 3 : undefined}
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
