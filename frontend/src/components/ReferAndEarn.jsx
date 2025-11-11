import React, { useMemo, useState } from "react";
import { Box, Paper, Typography, Stack, Button, Alert } from "@mui/material";

export default function ReferAndEarn({ title = "Refer & Earn", onlyConsumer = false }) {
  const [msg, setMsg] = useState("");

  const user = useMemo(() => {
    try {
      const ls = localStorage.getItem("user") || sessionStorage.getItem("user");
      return ls ? JSON.parse(ls) : {};
    } catch {
      return {};
    }
  }, []);

  const sponsorId = useMemo(() => {
    const sid = (user?.sponsor_id || user?.username || "").trim();
    return sid;
  }, [user]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Determine current user's role/category to decide which links to show
  const appRole = useMemo(() => {
    const r =
      (localStorage.getItem("role") || sessionStorage.getItem("role") || user?.role || "")
        .toString()
        .toLowerCase();
    return r;
  }, [user]);

  const userCategory = useMemo(() => {
    const c = (user?.category || user?.agency_category || user?.agency_level || "")
      .toString()
      .toLowerCase();
    return c;
  }, [user]);

  const isEmployee = appRole === "employee";
  const isSubFranchise =
    appRole === "agency" && (userCategory === "agency_sub_franchise" || userCategory === "sub_franchise");

  // renderMode: "sf" => show only Employee link, "emp" => show only Consumer link, "all" => show all
  const renderMode = isSubFranchise ? "sf" : isEmployee ? "emp" : "all";

  const getLink = (role, extra = {}) => {
    const params = new URLSearchParams({
      mode: "register",
      role,
      sponsor: sponsorId,
      ...extra,
    });
    return `${origin}/login?${params.toString()}`;
  };

  const links = useMemo(() => {
    // 1) Consumer registration link
    const consumer = getLink("user");
    // 2) Employee registration link
    const employee = getLink("employee");
    // 3) Sub-Franchise Agency registration link
    const subFranchise = getLink("agency", { agency_level: "sub_franchise" });
    return { consumer, employee, subFranchise };
  }, [sponsorId, origin]);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Sharable link copied to clipboard.");
      setTimeout(() => setMsg(""), 2500);
    } catch {
      setMsg("Copy failed. Select and copy the link manually.");
      setTimeout(() => setMsg(""), 3000);
    }
  };

  if (!sponsorId) {
    return null;
  }

  return (
    <Paper elevation={2} sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: "#fff" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: "#0C2D48", mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
        Share these links. New registrations will auto-fill your Sponsor ID.
      </Typography>

      {msg ? (
        <Alert severity="success" sx={{ mb: 1 }}>
          {msg}
        </Alert>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexWrap: "wrap" }}>
        {(onlyConsumer || renderMode === "all" || renderMode === "emp") && (
          <Button
            variant="contained"
            onClick={() => copy(links.consumer)}
            sx={{ textTransform: "none" }}
          >
            Copy Consumer Link
          </Button>
        )}

        {!onlyConsumer && (renderMode === "all" || renderMode === "sf") && (
          <Button
            variant="contained"
            onClick={() => copy(links.employee)}
            sx={{ textTransform: "none" }}
          >
            Copy Employee Link
          </Button>
        )}

        {!onlyConsumer && renderMode === "all" && (
          <Button
            variant="contained"
            onClick={() => copy(links.subFranchise)}
            sx={{ textTransform: "none" }}
          >
            Copy Sub‑Franchise Agency Link
          </Button>
        )}
      </Stack>

      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          Sponsor ID: {sponsorId}
        </Typography>
      </Box>
    </Paper>
  );
}
