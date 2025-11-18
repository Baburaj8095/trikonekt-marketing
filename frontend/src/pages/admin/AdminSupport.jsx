import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Divider,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import API from "../../api/api";

const TICKET_TYPES = [
  { value: "KYC_REVERIFY", label: "KYC Re-verification" },
  { value: "GENERAL", label: "General" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
];

const STATUS_COLOR = {
  open: "default",
  in_progress: "info",
  resolved: "success",
  rejected: "error",
  closed: "default",
};

function StatusChip({ status }) {
  const color = STATUS_COLOR[String(status || "").toLowerCase()] || "default";
  return <Chip size="small" label={String(status || "").toUpperCase()} color={color} variant="outlined" />;
}

export default function AdminSupport() {
  // Filters
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  // Data
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  // Selection + details
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Admin reply
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  // Status/assignee updates
  const [busyAction, setBusyAction] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  // Current admin id for "Assign to me"
  const [me, setMe] = useState(null);

  // Load current admin info
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await API.get("/accounts/me/");
        if (mounted) setMe(res?.data || null);
      } catch (_) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function fetchTickets() {
    try {
      setLoading(true);
      setErr("");
      setInfo("");
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (search && search.trim().length >= 2) params.search = search.trim();
      const res = await API.get("/admin/support/tickets/", { params, cacheTTL: 0 });
      const arr = Array.isArray(res?.data?.results) ? res.data.results : Array.isArray(res?.data) ? res.data : [];
      setTickets(arr);
      // if a ticket is selected, refresh the detail from the new list
      if (selectedId) {
        const d = arr.find((t) => t.id === selectedId);
        setDetail(d || null);
      }
    } catch (e) {
      setErr("Failed to load support tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTickets();
  }, [statusFilter, typeFilter]);

  function selectTicket(id) {
    setSelectedId(id);
    // Try to find detail from current list (serializer includes messages)
    setDetailLoading(true);
    const d = tickets.find((t) => t.id === id) || null;
    setDetail(d);
    setDetailLoading(false);
  }

  async function sendAdminReply() {
    if (!selectedId) return;
    const text = String(reply || "").trim();
    if (!text) return;
    try {
      setSending(true);
      await API.post(`/admin/support/tickets/${selectedId}/messages/`, { message: text });
      setReply("");
      await fetchTickets();
      setInfo("Reply sent.");
    } catch (e) {
      setErr("Failed to send reply.");
    } finally {
      setSending(false);
    }
  }

  async function assignToMe() {
    if (!selectedId || !me?.id) return;
    try {
      setBusyAction(true);
      await API.patch(`/admin/support/tickets/${selectedId}/`, { admin_assignee: me.id });
      await fetchTickets();
      setInfo("Assigned to you.");
    } catch (e) {
      setErr("Failed to assign ticket.");
    } finally {
      setBusyAction(false);
    }
  }

  async function updateStatus(newStatus) {
    if (!selectedId) return;
    try {
      setBusyAction(true);
      const payload = { status: newStatus };
      if (resolutionNote && resolutionNote.trim()) {
        payload.resolution_note = resolutionNote.trim();
      }
      await API.patch(`/admin/support/tickets/${selectedId}/`, payload);
      setResolutionNote("");
      await fetchTickets();
      setInfo(`Status updated: ${newStatus}`);
    } catch (e) {
      setErr("Failed to update status.");
    } finally {
      setBusyAction(false);
    }
  }

  async function allowKycReopen() {
    if (!selectedId) return;
    try {
      setBusyAction(true);
      const payload = {};
      if (resolutionNote && resolutionNote.trim()) {
        payload.note = resolutionNote.trim();
      }
      await API.post(`/admin/support/tickets/${selectedId}/approve-kyc/`, payload);
      setResolutionNote("");
      await fetchTickets();
      setInfo("KYC reopen allowed and ticket resolved.");
    } catch (e) {
      setErr("Failed to approve KYC re-verification.");
    } finally {
      setBusyAction(false);
    }
  }

  const Filters = () => (
    <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Support Tickets
        </Typography>
        <Button size="small" variant="outlined" onClick={fetchTickets}>
          Refresh
        </Button>
      </Stack>
      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth size="small">
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth size="small">
            <InputLabel id="type-filter-label">Type</InputLabel>
            <Select
              labelId="type-filter-label"
              label="Type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {TICKET_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            size="small"
            label="Search subject/message"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                fetchTickets();
              }
            }}
          />
        </Grid>
      </Grid>
    </Paper>
  );

  const TicketList = () => (
    <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : tickets.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No tickets found for the selected filters.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {tickets.map((t) => (
            <Box
              key={t.id}
              onClick={() => selectTicket(t.id)}
              sx={{
                p: 1,
                borderRadius: 1,
                border: "1px solid #e2e8f0",
                background: selectedId === t.id ? "rgba(14,165,233,0.08)" : "#fff",
                cursor: "pointer",
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1 }}>
                <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                  <Chip size="small" label={String(t.type || "")} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {t.subject}
                  </Typography>
                </Stack>
                <StatusChip status={t.status} />
              </Stack>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                {t.username ? `${t.username}${t.phone ? ` • ${t.phone}` : ""}` : ""}
                {t.pincode ? ` • ${t.pincode}` : ""} {t.state_name ? ` • ${t.state_name}` : ""}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.disabled", display: "block" }}>
                Updated: {t.updated_at ? new Date(t.updated_at).toLocaleString() : "-"}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );

  const TicketDetail = () => {
    if (!selectedId) {
      return (
        <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Select a ticket to review and respond.
          </Typography>
        </Paper>
      );
    }
    if (detailLoading) {
      return (
        <Paper elevation={2} sx={{ p: 2, borderRadius: 2, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} />
        </Paper>
      );
    }
    if (!detail) {
      return (
        <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
          <Alert severity="error">Ticket not found.</Alert>
        </Paper>
      );
    }

    const messages = Array.isArray(detail.messages) ? detail.messages : [];
    const allowKyc = String(detail.type || "") === "KYC_REVERIFY";

    return (
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
            <Chip size="small" label={String(detail.type || "")} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {detail.subject}
            </Typography>
          </Stack>
          <StatusChip status={detail.status} />
        </Stack>

        {/* Meta */}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          User: {detail.username} {detail.full_name ? `(${detail.full_name})` : ""} {detail.phone ? `• ${detail.phone}` : ""}
          {detail.pincode ? ` • ${detail.pincode}` : ""} {detail.state_name ? ` • ${detail.state_name}` : ""}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          Assignee: {detail.admin_assignee_username ? detail.admin_assignee_username : "Unassigned"} • Created:{" "}
          {detail.created_at ? new Date(detail.created_at).toLocaleString() : "-"} • Updated:{" "}
          {detail.updated_at ? new Date(detail.updated_at).toLocaleString() : "-"}
        </Typography>

        {detail.message ? (
          <Alert severity="info" sx={{ my: 1 }}>
            <strong>Initial message:</strong> {detail.message}
          </Alert>
        ) : null}

        {detail.resolution_note ? (
          <Alert severity="success">
            <strong>Resolution note:</strong> {detail.resolution_note}
          </Alert>
        ) : null}

        <Divider />

        {/* Actions */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
          <Button size="small" variant="outlined" onClick={assignToMe} disabled={busyAction || !me?.id}>
            Assign to me
          </Button>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="status-change-label">Change status</InputLabel>
            <Select
              labelId="status-change-label"
              label="Change status"
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) updateStatus(v);
              }}
            >
              <MenuItem value="">
                <em>Select…</em>
              </MenuItem>
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {allowKyc ? (
            <Button
              size="small"
              variant="contained"
              color="success"
              onClick={allowKycReopen}
              disabled={busyAction || String(detail.status || "") === "resolved"}
            >
              Allow KYC Reopen & Resolve
            </Button>
          ) : null}
        </Stack>

        <TextField
          size="small"
          label="Resolution note (optional, appended)"
          value={resolutionNote}
          onChange={(e) => setResolutionNote(e.target.value)}
          multiline
          minRows={2}
        />

        <Divider />

        {/* Conversation */}
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          Conversation
        </Typography>
        <Box sx={{ maxHeight: 360, overflowY: "auto", pr: 1, border: "1px solid #e2e8f0", borderRadius: 1, p: 1 }}>
          {messages.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No messages yet.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {messages.map((m) => (
                <Box
                  key={m.id}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                  }}
                >
                  <Stack direction="row" alignItems="baseline" spacing={1}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {m.author_username || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {m.message}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Box>

        {/* Admin reply */}
        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            placeholder="Type an admin reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                sendAdminReply();
              }
            }}
          />
          <Button variant="contained" onClick={sendAdminReply} disabled={sending || !String(reply || "").trim()}>
            {sending ? "Sending..." : "Send"}
          </Button>
        </Stack>
      </Paper>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 1, md: 2 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          Admin Support
        </Typography>
        {info ? <Alert severity="success" sx={{ py: 0.5 }}>{info}</Alert> : null}
      </Stack>
      {err ? <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert> : null}

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Filters />
        </Grid>
        <Grid item xs={12} md={4}>
          <TicketList />
        </Grid>
        <Grid item xs={12} md={8}>
          <TicketDetail />
        </Grid>
      </Grid>
    </Container>
  );
}
