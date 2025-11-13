import React, { useMemo, useState } from "react";
import { Box, Paper, Typography, Stack, Button, Alert } from "@mui/material";

export default function ReferAndEarn({ title = "Refer & Earn", onlyConsumer = false, sponsorUsername = "" }) {
  const [msg, setMsg] = useState("");

  const user = useMemo(() => {
    try {
      // Prefer consumer storage first to avoid picking up stale employee data
      const ls =
        localStorage.getItem("user_user") ||
        sessionStorage.getItem("user_user") ||
        localStorage.getItem("user") ||
        sessionStorage.getItem("user") ||
        localStorage.getItem("user_employee") ||
        sessionStorage.getItem("user_employee");
      const parsed = ls ? JSON.parse(ls) : {};
      // Support nested shapes like { user: { ... } }
      return parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object" ? parsed.user : parsed;
    } catch {
      return {};
    }
  }, []);

  const sponsorId = useMemo(() => {
    try {
      // 1) If a sponsorUsername was explicitly provided (e.g., Employee dashboard), always use it
      if (sponsorUsername) return String(sponsorUsername).trim();

      // 2) Consumer-only view: use logged-in username only (source of truth)
      if (onlyConsumer) {
        const uname = user?.username || (user && user.user && user.user.username) || "";
        return String(uname).trim();
      }

      // 3) Else (employee/agency contexts without explicit sponsorUsername): prefer sponsor fields
      const src =
        user?.sponsor_id ||
        user?.prefixed_id ||
        (user && user.user && (user.user.sponsor_id || user.user.prefixed_id)) ||
        user?.username ||
        (user && user.user && user.user.username) ||
        "";
      return String(src).trim();
    } catch {
      return "";
    }
  }, [sponsorUsername, onlyConsumer, user]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Determine current user's role/category to decide which links to show
  const appRole = useMemo(() => {
    const r =
      (localStorage.getItem("role_employee") ||
        sessionStorage.getItem("role_employee") ||
        localStorage.getItem("role_agency") ||
        sessionStorage.getItem("role_agency") ||
        localStorage.getItem("role_user") ||
        sessionStorage.getItem("role_user") ||
        localStorage.getItem("role") ||
        sessionStorage.getItem("role") ||
        user?.role ||
        user?.role_name ||
        (user && user.user && (user.user.role || user.user.role_name)) ||
        "")
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

  // Visibility flags
  // Employees and Sub‑Franchise should also get Consumer and Sub‑Franchise links
  const showEmployeeLink = !onlyConsumer && (isEmployee || isSubFranchise);
  const showConsumerLink = onlyConsumer || isEmployee || isSubFranchise || (!isEmployee && !isSubFranchise);
  const showSubFranchiseLink = !onlyConsumer && (isEmployee || isSubFranchise);

  const getLink = (role, extra = {}) => {
    const params = new URLSearchParams({
      mode: "register",
      role,
      ...(sponsorId ? { sponsor: sponsorId } : {}),
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
        {showConsumerLink && (
          <Button
            variant="contained"
            onClick={() => copy(links.consumer)}
            sx={{ textTransform: "none" }}
          >
            Copy Consumer Link
          </Button>
        )}

        {showEmployeeLink && (
          <Button
            variant="contained"
            onClick={() => (sponsorId ? copy(links.employee) : setMsg("Sponsor ID missing. Please re-login."))}
            sx={{ textTransform: "none" }}
          >
            Copy Employee Link
          </Button>
        )}

        {showSubFranchiseLink && (
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
          {sponsorId ? `Sponsor ID: ${sponsorId}` : "Sponsor ID not available"}
        </Typography>
      </Box>
    </Paper>
  );
}
