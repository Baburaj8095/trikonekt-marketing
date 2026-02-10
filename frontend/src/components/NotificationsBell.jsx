import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Button,
  CircularProgress,
} from "@mui/material";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import {
  notificationsUnreadCount,
  notificationsPinned,
  notificationsInbox,
  notificationsMarkRead,
  getAccessToken,
} from "../api/api";

/**
 * Lightweight notifications bell for the app header.
 * - Shows unread count badge
 * - Click to open a popover with Pinned + Recent items
 * - Allows "Mark all as read"
 */
export default function NotificationsBell() {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [unread, setUnread] = useState(0);
  const [pinned, setPinned] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadUnread = useCallback(async () => {
    try {
      const blocked = typeof window !== "undefined" && window.__tk_auth_blocked;
      const token = typeof getAccessToken === "function" ? getAccessToken() : null;
      if (!token || blocked) {
        setUnread(0);
        return;
      }
      const res = await notificationsUnreadCount();
      const n = (res && (res.count ?? res.unread ?? 0)) || 0;
      setUnread(Number(n) || 0);
    } catch {
      // ignore
    }
  }, []);

  const loadPinned = useCallback(async () => {
    try {
      const blocked = typeof window !== "undefined" && window.__tk_auth_blocked;
      const token = typeof getAccessToken === "function" ? getAccessToken() : null;
      if (!token || blocked) {
        setPinned([]);
        return;
      }
      const res = await notificationsPinned();
      const list = Array.isArray(res) ? res : res?.results || [];
      setPinned(list.slice(0, 5));
    } catch {
      setPinned([]);
    }
  }, []);

  const loadInbox = useCallback(async () => {
    try {
      const blocked = typeof window !== "undefined" && window.__tk_auth_blocked;
      const token = typeof getAccessToken === "function" ? getAccessToken() : null;
      if (!token || blocked) {
        setItems([]);
        return;
      }
      setLoading(true);
      const res = await notificationsInbox({ page: 1, page_size: 10 });
      const list = Array.isArray(res) ? res : res?.results || [];
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + conservative polling (only when tab is visible, plus on focus), to avoid frequent backend hits
  useEffect(() => {
    loadUnread();
    loadPinned();

    const onFocus = () => {
      try { loadUnread(); } catch (_) {}
    };
    const onVis = () => {
      try {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          loadUnread();
        }
      } catch (_) {}
    };

    if (typeof window !== "undefined") window.addEventListener("focus", onFocus);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);

    // No background interval polling; refresh on focus/visibility only
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadUnread, loadPinned]);

  const handleOpen = async (e) => {
    setAnchorEl(e.currentTarget);
    // lazily refresh inbox and unread each time opened
    await Promise.all([loadUnread(), loadInbox()]);
  };

  const handleClose = () => setAnchorEl(null);

  const handleMarkAllRead = async () => {
    try {
      await notificationsMarkRead({ all: true });
      setUnread(0);
      // Optimistically update items read status
      setItems((arr) =>
        (arr || []).map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    } catch {
      // ignore
    }
  };

  const renderItem = (n) => {
    const isRead = !!n.read_at;
    const primary = String(n.title || "").trim() || "(No title)";
    const secondary = String(n.body || "").trim();
    const ts = n.created_at ? new Date(n.created_at) : null;
    const when =
      ts && !isNaN(ts)
        ? ts.toLocaleString()
        : "";

    return (
      <React.Fragment key={n.id || `${n.title}-${n.created_at}`}>
        <ListItemButton
          dense
          selected={!isRead}
          onClick={() => {
            // single-tap mark as read UX (optimistic)
            if (!isRead) {
              setItems((arr) =>
                (arr || []).map((x) =>
                  x === n || x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x
                )
              );
              setUnread((u) => Math.max(0, (Number(u) || 0) - 1));
              notificationsMarkRead({ ids: [n.id] }).catch(() => {});
            }
            // deep-link if provided
            const link = String(n.deep_link || "").trim();
            if (link) {
              try {
                if (link.startsWith("http")) {
                  window.open(link, "_blank", "noopener,noreferrer");
                } else {
                  // internal route
                  window.location.assign(link);
                }
              } catch (_) {}
            }
          }}
        >
          <ListItemText
            primary={
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: !isRead ? 800 : 600 }}>
                  {primary}
                </Typography>
                {when ? (
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {when}
                  </Typography>
                ) : null}
              </Box>
            }
            secondary={
              secondary ? (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {secondary}
                </Typography>
              ) : null
            }
          />
        </ListItemButton>
        <Divider />
      </React.Fragment>
    );
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen} size="small" aria-label="Notifications">
        <Badge badgeContent={unread > 99 ? "99+" : unread} color="error">
          <NotificationsNoneIcon />
        </Badge>
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 360, maxWidth: "calc(100vw - 24px)" } }}
      >
        <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, flex: 1 }}>
            Notifications
          </Typography>
          <Button onClick={handleMarkAllRead} size="small" variant="text">
            Mark all read
          </Button>
        </Box>
        <Divider />

        {/* Pinned */}
        {(pinned || []).length ? (
          <>
            <Box sx={{ px: 1.5, pt: 1 }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                Pinned
              </Typography>
            </Box>
            <List dense disablePadding>
              {pinned.map(renderItem)}
            </List>
            <Divider />
          </>
        ) : null}

        {/* Inbox */}
        <Box sx={{ px: 1.5, pt: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
            Recent
          </Typography>
        </Box>
        {loading ? (
          <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircularProgress size={18} />
          </Box>
        ) : (
          <List dense disablePadding>
            {(items || []).length ? items.map(renderItem) : (
              <Box sx={{ p: 2, color: "text.secondary" }}>
                <Typography variant="body2">No notifications yet.</Typography>
              </Box>
            )}
          </List>
        )}
      </Popover>
    </>
  );
}
