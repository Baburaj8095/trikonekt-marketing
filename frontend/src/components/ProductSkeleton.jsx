import { Box, Skeleton } from "@mui/material";

export default function ProductSkeleton() {
  return (
    <Box
      sx={{
        minWidth: 170,
        bgcolor: "#fff",
        borderRadius: 2,
        p: 1,
      }}
    >
      <Skeleton variant="rectangular" height={120} />
      <Skeleton width="80%" sx={{ mt: 1 }} />
      <Skeleton width="60%" />
      <Skeleton height={36} sx={{ mt: 1 }} />
    </Box>
  );
}
