import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Container,
  Stack,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText
} from "@mui/material";

export default function About() {
  return (
    <Box sx={{ bgcolor: "#FFF6EC", minHeight: "100vh" }}>
      {/* ================= HEADER ================= */}
      <AppBar position="sticky" elevation={0} color="inherit">
        <Toolbar>
          <Typography fontWeight={900} fontSize={18}>
            About TRIKONEKT
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 3 }}>
        {/* ================= INTRO ================= */}
        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent>
            <Typography fontWeight={900} fontSize={20} mb={1}>
              TRIKONEKT
            </Typography>

            <Typography variant="body2" color="text.secondary">
              TRIKONEKT is a smart digital platform built to connect people,
              businesses, and opportunities in one powerful network.
              <br /><br />
              We believe that every connection creates value â€” and that value
              should be shared with everyone.
            </Typography>
          </CardContent>
        </Card>

        {/* ================= VISION & MISSION ================= */}
        <Typography fontWeight={800} fontSize={18} mb={1}>
          Vision & Mission
        </Typography>

        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent>
            <Typography variant="body2" mb={2}>
              To build a powerful digital network where every connection creates
              value, every user grows, and opportunities reach everyone.
              A world where spending becomes earning and networking becomes
              progress.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <List dense>
              <ListItem>
                <ListItemText primary="Provide a simple and smart Spend â†’ Connect â†’ Earn â†’ Grow system for all users" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Empower businesses with strong customer networks and digital visibility" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Create trustworthy, transparent, and growth-oriented connections" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Open new doors for employment, business expansion, and smart income" />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        {/* ================= TURN SPENDING INTO EARNINGS ================= */}
        <Typography fontWeight={800} fontSize={18} mb={1}>
          Turn Your Spendings into Earnings
        </Typography>

        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              This innovative model, â€œincome through spending,â€ enables users
              to become partners in wealth creation.
              <br /><br />
              By simply purchasing goods and services they need, users earn a
              share of the profits, allowing them to accumulate income over
              time.
              <br /><br />
              TRIKONEKT operates as a marketplace connecting users with
              businesses. As users shop, a portion of the profit generated from
              each transaction is shared with them â€” turning everyday spending
              into income.
            </Typography>
          </CardContent>
        </Card>

        {/* ================= UNLOCK WEALTH ================= */}
        <Typography fontWeight={800} fontSize={18} mb={1}>
          Unlock Unlimited Wealth
        </Typography>

        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent>
            <List dense>
              <ListItem>
                <ListItemText primary="Develop and expand your business" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Partner with wealth-building resources and networks" />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        {/* ================= WHAT WE OFFER ================= */}
        <Typography fontWeight={800} fontSize={18} mb={1}>
          What We Offer
        </Typography>

        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent>
            <List dense>
              <ListItem><ListItemText primary="Spin & Win (Free participation)" /></ListItem>
              <ListItem><ListItemText primary="Branded Company Gift Cards" /></ListItem>
              <ListItem><ListItemText primary="E-Commerce & Warehouses" /></ListItem>
              <ListItem><ListItemText primary="Tri Pay & Tri Cart" /></ListItem>
              <ListItem><ListItemText primary="Holiday Packages (Domestic & International)" /></ListItem>
              <ListItem><ListItemText primary="EV Motors" /></ListItem>
              <ListItem><ListItemText primary="Electronics & Home Appliances" /></ListItem>
              <ListItem><ListItemText primary="Properties" /></ListItem>
            </List>
          </CardContent>
        </Card>

        {/* ================= SUBSCRIPTIONS ================= */}
        <Typography fontWeight={800} fontSize={18} mb={1}>
          Subscriptions & Promotions
        </Typography>

        <Stack spacing={2} mb={3}>
          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography fontWeight={800}>PRIME PACKAGE â€“ â‚¹150</Typography>
              <Typography variant="body2">â€¢ E-Book</Typography>
              <Typography variant="body2">â€¢ Redeem Amount</Typography>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography fontWeight={800}>PROMO PACKAGE â€“ â‚¹750</Typography>
              <Typography variant="body2">â€¢ Product</Typography>
              <Typography variant="body2">â€¢ Redeem Amount</Typography>
              <Typography variant="body2">â€¢ E-Coupons (Lucky Dip)</Typography>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography fontWeight={800}>
                MONTHLY PROMO PACKAGE â€“ â‚¹759
              </Typography>
              <Typography variant="body2">â€¢ Electronics</Typography>
              <Typography variant="body2">â€¢ Home Appliances</Typography>
              <Typography variant="body2">â€¢ Furniture</Typography>
              <Typography variant="body2">â€¢ Holiday Packages</Typography>
            </CardContent>
          </Card>
        </Stack>

        {/* ================= BUSINESS PROMO ================= */}
        <Typography fontWeight={800} fontSize={18} mb={1}>
          Business Promotions
        </Typography>

        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent>
            <Typography fontWeight={700}>Agency</Typography>
            <Typography variant="body2">â€¢ Products</Typography>
            <Typography variant="body2">â€¢ Redeem Amount</Typography>

            <Divider sx={{ my: 2 }} />

            <Typography fontWeight={700}>Employee Job Promo</Typography>
            <Typography variant="body2">â€¢ Marketing</Typography>
            <Typography variant="body2">â€¢ Training</Typography>

            <Divider sx={{ my: 2 }} />

            <Typography fontWeight={700}>Merchant Business Promo</Typography>
            <Typography variant="body2">â€¢ Ads</Typography>
            <Typography variant="body2">â€¢ Promotion</Typography>
          </CardContent>
        </Card>

        {/* ================= CLOSING ================= */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Through our Connect, Earn, Grow model, TRIKONEKT converts daily
              purchases, services, and business interactions into meaningful
              income.
              <br /><br />
              Users are not just customers â€” they are growth partners in a
              transparent and trustworthy system.
              <br /><br />
              <strong>TRIKONEKT â€“ Where Connections Create Growth.</strong>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

