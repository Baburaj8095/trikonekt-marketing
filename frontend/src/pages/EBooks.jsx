import React, { useEffect, useState, useMemo } from "react";
import { Box, Grid, Typography, Button } from "@mui/material";
import API, { getMyEBooks } from "../api/api";

/**
 * EBooks
 * Standalone page section that lists user's purchased e‑books.
 * Safe to render inside a tab body.
 */
export default function EBooks() {
  const MEDIA_BASE = useMemo(() => {
    try {
      return (API?.defaults?.baseURL || "").replace(/\/api\/?$/, "");
    } catch {
      return "";
    }
  }, []);

  const [ebooks, setEbooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function loadMyEBooks() {
    try {
      setLoading(true);
      setErr("");
      const res = await getMyEBooks();
      const raw = Array.isArray(res) ? res : (res?.results || []);
      const flat = (raw || []).map((it) => {
        const eb = (it && typeof it === "object" && (it.ebook || it)) || {};
        let cu = eb.cover_url || eb.coverUrl || null;
        let fu = eb.file_url || eb.fileUrl || null;
        if (cu && typeof cu === "string" && !/^https?:\/\//i.test(cu)) {
          cu = `${MEDIA_BASE}${cu}`;
        }
        if (fu && typeof fu === "string" && !/^https?:\/\//i.test(fu)) {
          fu = `${MEDIA_BASE}${fu}`;
        }
        return {
          id: eb.id ?? it?.id,
          title: eb.title || "E‑Book",
          cover_url: cu,
          file_url: fu,
        };
      });
      setEbooks(flat || []);
    } catch (e) {
      setEbooks([]);
      setErr("Failed to load e‑books.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMyEBooks();
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
        My E‑Books
      </Typography>
      {loading ? (
        <Typography variant="body2">Loading...</Typography>
      ) : err ? (
        <Typography variant="body2" color="error">
          {err}
        </Typography>
      ) : ebooks && ebooks.length > 0 ? (
        <Grid container spacing={2}>
          {ebooks.map((eb) => (
            <Grid key={eb.id} item xs={12} sm={6} md={4}>
              <Box
                sx={{
                  display: "flex",
                  gap: 1.5,
                  alignItems: "center",
                  border: "1px solid #e2e8f0",
                  borderRadius: 2,
                  p: 1.5,
                  bgcolor: "#fff",
                }}
              >
                {eb.cover_url ? (
                  <Box
                    component="img"
                    src={eb.cover_url}
                    alt={eb.title || "E‑Book"}
                    sx={{ width: 44, height: 60, objectFit: "cover", borderRadius: 1 }}
                  />
                ) : null}
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 700, lineHeight: 1.2, pr: 1 }}
                  >
                    {eb.title || "E‑Book"}
                  </Typography>
                  {eb.file_url ? (
                    <Button
                      size="small"
                      component="a"
                      href={eb.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      variant="outlined"
                      sx={{ mt: 0.5, textTransform: "none" }}
                    >
                      Open
                    </Button>
                  ) : null}
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No e‑books yet.
        </Typography>
      )}
    </Box>
  );
}
