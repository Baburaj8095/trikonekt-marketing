import React, { useMemo, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Box } from "@mui/material";
import FranchiseMobileHub from "./FranchiseMobileHub";

export default function FranchiseDashboard() {
  const navigate = useNavigate();

  // Read Agency Session
  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user_agency") || sessionStorage.getItem("user_agency");
      const token = localStorage.getItem("token_agency") || sessionStorage.getItem("token_agency");
      if (raw && token) {
        return JSON.parse(raw);
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem("user_agency");
      sessionStorage.removeItem("user_agency");
      localStorage.removeItem("token_agency");
      sessionStorage.removeItem("token_agency");
      localStorage.removeItem("role_agency");
      sessionStorage.removeItem("role_agency");
    } catch (_) {}
    navigate("/auth/login?role=agency&mode=franchise", { replace: true });
  }, [navigate]);

  if (!storedUser) {
    return <Navigate to="/auth/login?role=agency&mode=franchise" replace />;
  }

  const agencyCategory = (storedUser?.category || "agency_pincode").toLowerCase();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F8FAFC" }}>
      <Box
        sx={{
          maxWidth: { xs: "100%", md: 520 },
          mx: "auto",
          minHeight: "100vh",
          bgcolor: "#FFFFFF",
          boxShadow: { md: "0 0 35px rgba(0,0,0,0.14)" },
        }}
      >
        <FranchiseMobileHub
          initialRole={agencyCategory}
          user={storedUser}
          onLogout={handleLogout}
          onSwitchRole={handleLogout}
        />
      </Box>
    </Box>
  );
}
