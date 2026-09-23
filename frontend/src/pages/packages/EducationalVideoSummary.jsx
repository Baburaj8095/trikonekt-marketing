import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import SchoolRoundedIcon from "@mui/icons-material/SchoolRounded";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import API, { listMyPromoPurchases } from "../../api/api";
import resolveApiMediaUrl from "../../utils/media";

const C = {
  bg: "#f8fafc",
  surface: "#ffffff",
  primary: "#2563eb",
  primaryDark: "#1d4ed8",
  textPri: "#0f172a",
  textSec: "#64748b",
  border: "#e2e8f0",
  success: "#16a34a",
  successBg: "#dcfce7",
};

export default function EducationalVideoSummary() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'my_videos' | 'locked' | 'progress'
  const [videos, setVideos] = useState([]);
  const [primeRanks, setPrimeRanks] = useState([]);
  const [achievedPrimeLevel, setAchievedPrimeLevel] = useState(0);
  const [hasApprovedBase, setHasApprovedBase] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);

  const MEDIA_BASE = useMemo(() => String(API?.defaults?.baseURL || "").replace(/\/api\/?$/, ""), []);
  const resolveRaw = useCallback((raw) => resolveApiMediaUrl({ image_url: raw }, MEDIA_BASE), [MEDIA_BASE]);

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [videoRes, rankRes, eligRes, promoRes] = await Promise.allSettled([
          API.get("/business/team-consumer/educational-videos/", { cacheTTL: 2500, retryAttempts: 1 }),
          API.get("/ranks/", { cacheTTL: 10000, retryAttempts: 1 }),
          API.get("/user/upgrade-eligibility/", { params: { summary: "achieved" }, cacheTTL: 2500, retryAttempts: 1 }),
          listMyPromoPurchases(),
        ]);

        if (!alive) return;

        if (videoRes.status === "fulfilled") {
          setVideos(Array.isArray(videoRes.value?.data?.results) ? videoRes.value.data.results : []);
        }
        if (rankRes.status === "fulfilled") {
          const list = Array.isArray(rankRes.value?.data?.results)
            ? rankRes.value.data.results
            : Array.isArray(rankRes.value?.data)
            ? rankRes.value.data
            : [];
          const sorted = list
            .filter((r) => String(r.rank_type || "PRIME").toUpperCase() === "PRIME")
            .sort((a, b) => Number(a.level_number || 0) - Number(b.level_number || 0));
          setPrimeRanks(sorted);
        }
        if (eligRes.status === "fulfilled") {
          setAchievedPrimeLevel(Number(eligRes.value?.data?.achieved_rank_level || eligRes.value?.data?.achieved_level || 0));
        }
        if (promoRes.status === "fulfilled") {
          const hist = promoRes.value;
          const ok = Array.isArray(hist) && hist.some((h) => {
            const status = String(h?.status || "").toUpperCase();
            const type = String(h?.package?.type || "").toUpperCase();
            return status === "APPROVED" && type !== "MONTHLY";
          });
          setHasApprovedBase(!!ok);
        }
      } catch (_) {
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();
    return () => {
      alive = false;
    };
  }, []);

  const videoSlots = useMemo(() => {
    const defaultDurations = ["12:30", "18:45", "15:20", "20:10", "14:15", "16:40", "22:05", "19:30"];
    const ranks =
      Array.isArray(primeRanks) && primeRanks.length
        ? primeRanks.slice(0, 8)
        : Array.from({ length: 8 }).map((_, idx) => ({
            id: null,
            level_number: idx + 1,
            rank_name: `Prime ${idx + 1}`,
            upgrade_amount: idx === 0 ? "1000" : "250",
          }));

    const byLevel = new Map();
    const unmapped = [];
    (Array.isArray(videos) ? videos : []).forEach((v) => {
      const lvl = Number(v?.required_rank_level || 0);
      if (lvl) byLevel.set(lvl, v);
      else unmapped.push(v);
    });

    return ranks.map((rank, idx) => {
      const level = Number(rank?.level_number || idx + 1);
      const mapped = byLevel.get(level) || unmapped[idx] || {};
      const isPurchased =
        Number(achievedPrimeLevel || 0) >= level ||
        !!mapped.can_access ||
        (level === 1 && (hasApprovedBase || Number(achievedPrimeLevel || 0) >= 1));
      const rankId = mapped.required_rank || rank?.id || null;
      const duration = mapped.duration || defaultDurations[idx % defaultDurations.length];
      const cost = rank?.upgrade_amount || (level === 1 ? "1000" : "250");

      return {
        ...mapped,
        id: mapped.id || `video-slot-${level}`,
        title: mapped.title || `Video ${level}`,
        subtitle: mapped.description || (level === 1 ? "Basics and introduction" : `Learn advanced building strategies`),
        required_rank: rankId,
        required_rank_name: mapped.required_rank_name || rank?.rank_name || `Prime L${level}`,
        required_rank_level: level,
        cost: cost,
        duration: duration,
        can_access: !!mapped.can_access || isPurchased,
        is_purchased: isPurchased,
      };
    });
  }, [achievedPrimeLevel, primeRanks, videos]);

  const filteredVideos = useMemo(() => {
    if (activeTab === "my_videos") return videoSlots.filter((v) => v.is_purchased);
    if (activeTab === "locked") return videoSlots.filter((v) => !v.is_purchased);
    if (activeTab === "progress") return videoSlots.filter((v) => v.is_purchased);
    return videoSlots;
  }, [activeTab, videoSlots]);

  const getYouTubeEmbedId = (v) => {
    if (v?.youtube_video_id) return v.youtube_video_id;
    const url = v?.youtube_url || v?.video_url || v?.video;
    if (!url) return "";
    const match = String(url).match(/(?:v=|\/embed\/|\/v\/|https:\/\/youtu\.be\/|\/watch\?v=|\&v=)([^#\&\?]{11})/);
    return match ? match[1] : "";
  };

  const handleOpenVideo = (v) => {
    const videoUrl = resolveRaw(v.video_url || v.video);
    const ytEmbedId = getYouTubeEmbedId(v);
    if (v.is_purchased) {
      setActiveVideo({
        title: v.title,
        ytEmbedId: ytEmbedId || "dQw4w9WgXcQ",
        videoUrl,
      });
    } else {
      navigate("/user/packages/digital-education-prime");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: C.bg, pb: 6, pt: { xs: 1, sm: 2 }, px: { xs: 1.5, sm: 2.5 } }}>
      {/* Top Category Filter Tabs */}
      <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 1, mb: 2, "&::-webkit-scrollbar": { display: "none" } }}>
        {[
          { key: "all", label: "All" },
          { key: "my_videos", label: "My Videos" },
          { key: "locked", label: "Locked" },
          { key: "progress", label: "Progress" },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Chip
              key={tab.key}
              label={tab.label}
              onClick={() => setActiveTab(tab.key)}
              sx={{
                height: 36,
                px: 1.5,
                fontWeight: 700,
                fontSize: 13,
                borderRadius: "20px",
                bgcolor: active ? C.primary : "#ffffff",
                color: active ? "#ffffff" : C.textSec,
                border: active ? `1px solid ${C.primary}` : `1px solid ${C.border}`,
                boxShadow: active ? "0 4px 14px rgba(37,99,235,0.25)" : "0 2px 6px rgba(15,23,42,0.03)",
                cursor: "pointer",
                transition: "all 160ms ease",
                "&:hover": { bgcolor: active ? C.primaryDark : "#f1f5f9" },
              }}
            />
          );
        })}
      </Stack>

      {/* Feature Hero Banner (Frame 3 style) */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 },
          mb: 3,
          borderRadius: 4,
          background: "linear-gradient(135deg, #e0f2fe 0%, #dbeafe 60%, #eff6ff 100%)",
          border: "1px solid #bfdbfe",
          boxShadow: "0 8px 24px rgba(37,99,235,0.08)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box sx={{ pr: 2, maxWidth: "72%" }}>
            <Typography variant="h6" sx={{ fontWeight: 900, color: C.textPri, fontSize: { xs: 18, sm: 22 }, mb: 0.5 }}>
              Learn. Grow. Succeed.
            </Typography>
            <Typography sx={{ fontSize: 13, color: C.textSec, fontWeight: 500, lineHeight: 1.4 }}>
              Access digital education and build your future.
            </Typography>
          </Box>
          <Box
            sx={{
              width: 58,
              height: 58,
              borderRadius: "18px",
              bgcolor: "#ffffff",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 8px 20px rgba(37,99,235,0.15)",
              color: C.primary,
            }}
          >
            <SchoolRoundedIcon sx={{ fontSize: 34 }} />
          </Box>
        </Stack>
      </Paper>

      {/* Video List Items */}
      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
          <CircularProgress size={36} sx={{ color: C.primary }} />
          <Typography sx={{ mt: 2, fontSize: 13, color: C.textSec, fontWeight: 600 }}>Loading educational videos...</Typography>
        </Stack>
      ) : (
        <Stack spacing={2}>
          {filteredVideos.map((v) => {
            const ytEmbedId = getYouTubeEmbedId(v);
            const videoUrl = resolveRaw(v.video_url || v.video);
            const ytThumb = ytEmbedId ? `https://img.youtube.com/vi/${ytEmbedId}/hqdefault.jpg` : "";
            const thumb = ytThumb || resolveRaw(v.thumbnail_url || v.thumbnail);

            return (
              <Paper
                key={v.id}
                elevation={0}
                onClick={() => handleOpenVideo(v)}
                sx={{
                  p: 1.5,
                  borderRadius: 3.5,
                  bgcolor: C.surface,
                  border: `1px solid ${C.border}`,
                  boxShadow: "0 4px 16px rgba(15,23,42,0.04)",
                  cursor: "pointer",
                  transition: "transform 140ms ease, box-shadow 140ms ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                  },
                  "&:active": { transform: "scale(0.99)" },
                }}
              >
                <Stack direction="row" spacing={1.75} alignItems="center">
                  {/* Video Thumbnail Box */}
                  <Box
                    sx={{
                      width: 88,
                      height: 72,
                      borderRadius: 2.5,
                      overflow: "hidden",
                      position: "relative",
                      bgcolor: "#1e293b",
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      backgroundImage: thumb ? `url(${thumb})` : "none",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {!thumb && (
                      <SchoolRoundedIcon sx={{ fontSize: 32, color: "rgba(255,255,255,0.4)" }} />
                    )}
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        bgcolor: "rgba(37,99,235,0.85)",
                        color: "#ffffff",
                        display: "grid",
                        placeItems: "center",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      <PlayArrowRoundedIcon sx={{ fontSize: 20 }} />
                    </Box>
                  </Box>

                  {/* Video Details */}
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: 14, color: C.textPri, truncate: true, mb: 0.25 }}>
                      {v.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: C.textSec, mb: 0.75, noWrap: true }}>
                      {v.subtitle}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontSize: 11, color: C.textSec, fontWeight: 600 }}>
                        🕒 {v.duration}
                      </Typography>
                    </Stack>
                  </Box>

                  {/* Right Status Badge */}
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    {v.is_purchased ? (
                      <Chip
                        label="Purchased"
                        size="small"
                        icon={<CheckCircleRoundedIcon sx={{ fontSize: "14px !important", color: `${C.success} !important` }} />}
                        sx={{
                          height: 28,
                          px: 0.5,
                          fontWeight: 800,
                          fontSize: 11,
                          bgcolor: C.successBg,
                          color: C.success,
                          borderRadius: "14px",
                          border: `1px solid ${C.successBg}`,
                        }}
                      />
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/user/packages/digital-education-prime");
                        }}
                        sx={{
                          height: 30,
                          px: 1.5,
                          borderRadius: "15px",
                          fontSize: 12,
                          fontWeight: 800,
                          textTransform: "none",
                          bgcolor: C.primary,
                          boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
                          "&:hover": { bgcolor: C.primaryDark },
                        }}
                      >
                        Buy ₹{v.cost}
                      </Button>
                    )}
                    <IconButton size="small" sx={{ color: C.textSec }}>
                      <MoreVertIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* Popup Video Player Modal */}
      <Dialog
        open={Boolean(activeVideo)}
        onClose={() => setActiveVideo(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 4, overflow: "hidden", bgcolor: "#0f172a", color: "#ffffff" },
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{activeVideo?.title}</Typography>
          <IconButton onClick={() => setActiveVideo(null)} sx={{ color: "#ffffff" }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: "#000000", height: 320 }}>
          {activeVideo?.ytEmbedId ? (
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${activeVideo.ytEmbedId}?autoplay=1&rel=0&modestbranding=1`}
              title={activeVideo.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : activeVideo?.videoUrl ? (
            <video width="100%" height="100%" controls autoPlay src={activeVideo.videoUrl} />
          ) : (
            <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}>
              <Typography sx={{ color: "#94a3b8", fontSize: 14 }}>Video player ready.</Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
