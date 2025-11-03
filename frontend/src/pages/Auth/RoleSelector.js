// src/components/Auth/RoleSelector.js
import React from "react";
import { MenuItem, Select, FormControl, InputLabel } from "@mui/material";

const RoleSelector = ({ role, setRole }) => {
  return (
    <FormControl fullWidth>
      <InputLabel>Role</InputLabel>
      <Select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        label="Role"
      >
        <MenuItem value="user">Consumer</MenuItem>
        <MenuItem value="agency">Agency</MenuItem>
        <MenuItem value="employee">Employee</MenuItem>
        <MenuItem value="business">Business</MenuItem>
      </Select>
    </FormControl>
  );
};

export default RoleSelector;
