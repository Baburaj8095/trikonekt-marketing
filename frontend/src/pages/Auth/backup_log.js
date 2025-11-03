// src/components/Auth/Login.js
import React, { useState, useEffect } from "react";
import {
  TextField,
  Button,
  Container,
  Typography,
  Box,
  Paper,
} from "@mui/material";
import API from "../../api/api";
import PublicNavbar from "../../components/PublicNavbar";
import RoleSelector from "./RoleSelector";
import { useNavigate, useLocation } from "react-router-dom";

const Login = () => {
  const [role, setRole] = useState("user");
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qRole = params.get("role");
    if (qRole) setRole(qRole);
  }, [location.search]);

  const loginField = {
    label:
      role === "user"
        ? "Phone Number"
        : role === "employee"
        ? "Employee ID"
        : "Agency User ID",
    type: role === "user" ? "tel" : "text",
    inputMode: role === "user" ? "numeric" : "text",
    placeholder:
      role === "user"
        ? "Enter your phone number"
        : role === "employee"
        ? "Enter your employee ID"
        : "Enter your agency user ID",
    pattern: role === "user" ? "[0-9]*" : undefined,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/accounts/login/", { ...formData, role });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", role);
      localStorage.setItem("user", JSON.stringify({ role }));
      alert("Login successful!");
      switch (role) {
        case "user":
          navigate("/user/dashboard", { replace: true });
          break;
        case "agency":
          navigate("/agency/dashboard", { replace: true });
          break;
        case "employee":
          navigate("/employee/dashboard", { replace: true });
          break;
        default:
          navigate("/", { replace: true });
      }
    } catch (err) {
      console.error(err);
      alert("Login failed!");
    }
  };

  return (
    <>
      <PublicNavbar />
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#f7f9fc", p: 2 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2, width: "100%", maxWidth: 480, minHeight: 480 }}>
        <Typography variant="h4" align="center" sx={{ mb: 2 }}>
          Login
        </Typography>
        <form onSubmit={handleSubmit}>
          <RoleSelector role={role} setRole={setRole} />
          <TextField
            label={loginField.label}
            name="username"
            type={loginField.type}
            fullWidth
            margin="normal"
            placeholder={loginField.placeholder}
            value={formData.username}
            onChange={handleChange}
            inputProps={{ inputMode: loginField.inputMode, pattern: loginField.pattern }}
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            fullWidth
            margin="normal"
            value={formData.password}
            onChange={handleChange}
            required
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 3 }}
          >
            Login
          </Button>
        </form>
      </Paper>
    </Box>
  </>
  );
};

export default Login;
