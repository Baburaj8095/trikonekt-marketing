import { Box, Button, Typography } from "@mui/material";
import { useCartStore } from "../../store/cartStore";

export default function StickyCartBar() {
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.totalPrice());

  if (!items.length) return null;

  return (
    <Box sx={{ position: "fixed", bottom: 56, left: 0, right: 0, bgcolor: "#145DA0", p: 1 }}>
      <Typography color="#fff">Total: ₹{total}</Typography>
      <Button variant="contained">View Cart</Button>
    </Box>
  );
}
