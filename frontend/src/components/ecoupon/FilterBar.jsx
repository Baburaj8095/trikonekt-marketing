import React from "react";
import {
  Box,
  Stack,
  TextField,
  InputAdornment,
  Button,
  Typography,
  Chip,
  Slider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

/**
 * FilterBar
 * - Denomination dropdown
 * - Search box
 * - Price range slider
 * - Refresh button
 *
 * Props:
 * - denomOptions: string[] (e.g., ["all", "100", "200"])
 * - denomFilter: string
 * - onDenomChange: (value: string) => void
 * - search: string
 * - onSearchChange: (value: string) => void
 * - priceRange: [number, number]
 * - priceBounds: [number, number]
 * - onPriceChange: (range: [number, number]) => void
 * - onRefresh: () => void
 * - loading?: boolean
 */
export default function FilterBar({
  denomOptions = ["all"],
  denomFilter = "all",
  onDenomChange,
  search = "",
  onSearchChange,
  priceRange = [0, 0],
  priceBounds = [0, 0],
  onPriceChange,
  onRefresh,
  loading = false,
}) {
  const hasPrice = Number.isFinite(priceBounds[0]) && Number.isFinite(priceBounds[1]) && priceBounds[1] > priceBounds[0];

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#fff",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", md: "center" }}
      >
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search coupons..."
          value={search}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: { xs: "100%", md: 280 } }}
        />

        {/* Denomination */}
        <TextField
          size="small"
          select
          label="Denomination"
          value={denomFilter}
          onChange={(e) => onDenomChange && onDenomChange(e.target.value)}
          SelectProps={{ native: true }}
          sx={{ minWidth: { xs: "100%", md: 180 } }}
        >
          {denomOptions.map((d) => (
            <option key={d} value={d}>
              {d === "all" ? "All" : `₹${d}`}
            </option>
          ))}
        </TextField>

        {/* Price range */}
        {hasPrice ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, px: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Price:
            </Typography>
            <Slider
              value={priceRange}
              onChange={(_, v) => {
                if (!Array.isArray(v)) return;
                onPriceChange && onPriceChange([v[0], v[1]]);
              }}
              valueLabelDisplay="auto"
              min={Math.floor(priceBounds[0])}
              max={Math.ceil(priceBounds[1])}
              sx={{ flex: 1 }}
            />
            <Chip
              size="small"
              label={`₹${Math.round(priceRange[0])} - ₹${Math.round(priceRange[1])}`}
              variant="outlined"
            />
          </Stack>
        ) : null}

        <Box flex={{ md: 1 }} />

        <Button
          size="small"
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={onRefresh}
          disabled={loading}
          sx={{ fontWeight: 800 }}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </Stack>
    </Box>
  );
}
