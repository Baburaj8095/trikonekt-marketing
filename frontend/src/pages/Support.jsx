import React, { useEffect, useMemo, useState, useCallback } from "react";
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
import API from "../api/api";

const TICKET_TYPES = [
  { value: "KYC_REVERIFY", label: "KYC Re-verification" },
  { value: "GENERAL", label: "General" },
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

/**
 * Moving subcomponents outside the Support component keeps their type identity stable,
 * preventing unmount/mount on each parent re-render. This fixes input focus loss and
 * "can't type continuously" issues in controlled TextFields.
 */
function TicketList({ tickets, loading, selectedId, onSelect, onRefresh }) {
  return (
    <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          My Support Tickets
        </Typography>
        <Button size="small" variant="outlined" onClick={onRefresh}>
          Refresh
        </Button>
      </Stack>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : tickets.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No tickets yet. Create one using the form below.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {tickets.map((t) => (
            <Box
              key={t.id}
              onClick={() => onSelect(t.id)}
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
              {t.message ? (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {String(t.message).slice(0, 120)}
                  {String(t.message).length > 120 ? "…" : ""}
                </Typography>
              ) : null}
              <Typography variant="caption" sx={{ color: "text.disabled", display: "block" }}>
                Updated: {t.updated_at ? new Date(t.updated_at).toLocaleString() : "-"}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}

function NewTicketForm({ creating, createErr, newTicket, setNewTicket, onSubmit, canSubmitNew }) {
  return (
    <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Create New Ticket
      </Typography>
      {createErr ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {createErr}
        </Alert>
      ) : null}
      <Box component="form" onSubmit={onSubmit} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <FormControl fullWidth size="small">
          <InputLabel id="ticket-type-label">Type</InputLabel>
          <Select
            labelId="ticket-type-label"
            label="Type"
            value={newTicket.type}
            onChange={(e) => setNewTicket((p) => ({ ...p, type: e.target.value }))}
          >
            {TICKET_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="Subject"
          value={newTicket.subject}
          onChange={(e) => setNewTicket((p) => ({ ...p, subject: e.target.value }))}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === "function") {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
          onKeyUp={(e) => {
            e.stopPropagation();
            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === "function") {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
          onKeyPress={(e) => {
            e.stopPropagation();
            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === "function") {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          required
        />
        <TextField
          size="small"
          label="Message (optional)"
          value={newTicket.message}
          onChange={(e) => setNewTicket((p) => ({ ...p, message: e.target.value }))}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === "function") {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
          onKeyUp={(e) => {
            e.stopPropagation();
            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === "function") {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
          onKeyPress={(e) => {
            e.stopPropagation();
            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === "function") {
              e.nativeEvent.stopImmediatePropagation();
            }
          }}
          multiline
          minRows={3}
        />
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="submit" variant="contained" disabled={creating || !canSubmitNew()}>
            {creating ? "Creating..." : "Create Ticket"}
          </Button>
        </Box>
      </Box>
      <Alert severity="info" sx={{ mt: 2 }}>
        For KYC changes after verification, choose type "KYC Re-verification". Admin will enable a one-time edit
        window for your KYC form.
      </Alert>
    </Paper>
  );
}

function TicketDetail({
  selectedId,
  detailLoading,
  detail,
  customerHeader,
  reply,
  setReply,
  sendReply,
  msgSending,
}) {
  if (!selectedId) {
    return (
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Select a ticket to view details and reply.
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
        <Alert severity="error">Failed to load ticket.</Alert>
      </Paper>
    );
  }
  const messages = Array.isArray(detail.messages) ? detail.messages : [];
  return (
    <Paper elevation={2} sx={{ p: 2, borderRadius: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
          <Chip size="small" label={String(detail.type || "")} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {detail.subject}
          </Typography>
        </Stack>
        <StatusChip status={detail.status} />
      </Stack>
      {detail.resolution_note ? (
        <Alert severity="info">
          <strong>Admin note:</strong> {detail.resolution_note}
        </Alert>
      ) : null}
      <Divider />
      <Box sx={{ maxHeight: 360, overflowY: "auto", pr: 1 }}>
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
                    {m.author_username === detail.user_username ? customerHeader : "Admin"}
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
      <Divider />
      <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            placeholder="Type a message to admin..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === "function") {
                e.nativeEvent.stopImmediatePropagation();
              }
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                sendReply();
              }
            }}
            onKeyUp={(e) => {
              e.stopPropagation();
              if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === "function") {
                e.nativeEvent.stopImmediatePropagation();
              }
            }}
            onKeyPress={(e) => {
              e.stopPropagation();
              if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === "function") {
                e.nativeEvent.stopImmediatePropagation();
              }
            }}
          />
        <Button variant="contained" onClick={sendReply} disabled={msgSending || !String(reply || "").trim()}>
          {msgSending ? "Sending..." : "Send"}
        </Button>
      </Stack>
    </Paper>
  );
}

export default function Support() {
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  const [newTicket, setNewTicket] = useState({
    type: "GENERAL",
    subject: "",
    message: "",
  });

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [msgSending, setMsgSending] = useState(false);
  const [reply, setReply] = useState("");

  const customerHeader = useMemo(() => {
    try {
      const raw =
        localStorage.getItem("user_user") ||
        sessionStorage.getItem("user_user") ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user");
      const u = raw ? JSON.parse(raw) : {};
      const user = u?.user && typeof u.user === "object" ? u.user : u;
      return user?.full_name || user?.username || "You";
    } catch {
      return "You";
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const res = await API.get("/accounts/support/tickets/");
      setTickets(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setErr("Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      setDetailLoading(true);
      const res = await API.get(`/accounts/support/tickets/${id}/`);
      setDetail(res?.data || null);
    } catch (e) {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  const canSubmitNew = useCallback(() => {
    const t = (newTicket.type || "").trim();
    const s = String(newTicket.subject || "").trim();
    return t && s.length >= 3;
  }, [newTicket.type, newTicket.subject]);

  const createTicket = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!canSubmitNew()) {
        setCreateErr("Please select a type and enter a subject (min 3 chars).");
        return;
      }
      try {
        setCreating(true);
        setCreateErr("");
        setInfo("");
        const payload = {
          type: newTicket.type,
          subject: String(newTicket.subject || "").trim(),
          message: String(newTicket.message || "").trim(),
        };
        const res = await API.post("/accounts/support/tickets/", payload);
        setInfo("Ticket created.");
        setNewTicket({ type: "GENERAL", subject: "", message: "" });
        await fetchTickets();
        const created = res?.data;
        if (created?.id) setSelectedId(created.id);
      } catch (err) {
        const msg =
          err?.response?.data?.detail ||
          (err?.response?.data ? JSON.stringify(err.response.data) : "Failed to create ticket.");
        setCreateErr(String(msg));
      } finally {
        setCreating(false);
      }
    },
    [canSubmitNew, fetchTickets, newTicket.type, newTicket.subject, newTicket.message]
  );

  const sendReply = useCallback(async () => {
    if (!selectedId) return;
    const text = String(reply || "").trim();
    if (!text) return;
    try {
      setMsgSending(true);
      await API.post(`/accounts/support/tickets/${selectedId}/messages/`, { message: text });
      setReply("");
      await fetchDetail(selectedId);
      setInfo("Reply sent.");
    } catch (e) {
      setErr("Failed to send message.");
    } finally {
      setMsgSending(false);
    }
  }, [reply, selectedId, fetchDetail]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1, md: 2 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Support
        </Typography>
        {info ? <Alert severity="success" sx={{ py: 0.5 }}>{info}</Alert> : null}
      </Stack>
      {err ? <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert> : null}
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TicketList
            tickets={tickets}
            loading={loading}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefresh={fetchTickets}
          />
          <Box sx={{ height: 12 }} />
          <NewTicketForm
            creating={creating}
            createErr={createErr}
            newTicket={newTicket}
            setNewTicket={setNewTicket}
            onSubmit={createTicket}
            canSubmitNew={canSubmitNew}
          />
        </Grid>
        <Grid item xs={12} md={8}>
          <TicketDetail
            selectedId={selectedId}
            detailLoading={detailLoading}
            detail={detail}
            customerHeader={customerHeader}
            reply={reply}
            setReply={setReply}
            sendReply={sendReply}
            msgSending={msgSending}
          />
        </Grid>
      </Grid>
    </Container>
  );
}
