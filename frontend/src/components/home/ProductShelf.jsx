import { Box, Typography, Card, CardContent, Button } from "@mui/material";
import { useCartStore } from "../../store/cartStore";

export default function ProductShelf({ title, items }) {
  const addToCart = useCartStore((s) => s.addToCart);

  return (
    <Box>
      <Typography fontWeight={700}>{title}</Typography>
      <Box sx={{ display: "flex", gap: 1, overflowX: "auto" }}>
        {items.map((p) => (
          <Card key={p.id} sx={{ minWidth: 160 }}>
            <img src={p.image} alt={p.name} width="100%" height={120} />
            <CardContent>
              <Typography fontSize={13} fontWeight={700}>
                {p.name}
              </Typography>
              <Button size="small" onClick={() => addToCart(p)}>
                Add to Cart
              </Button>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
