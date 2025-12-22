import React, { useEffect, useState } from "react";
import { Box, Typography, Grid, Card, CardContent, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { getMerchantProfile, listMyShops } from "../../api/api";

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [p, s] = await Promise.all([
          getMerchantProfile().catch(() => null),
          listMyShops().catch(() => []),
        ]);
        if (!cancelled) {
          setProfile(p);
          setShops(Array.isArray(s) ? s : (s?.results || []));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const verified = Boolean(profile?.is_verified);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Merchant Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your merchant profile and shops.
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Merchant Profile
              </Typography>
              {loading ? (
                <Typography variant="body2" color="text.secondary">Loading…</Typography>
              ) : (
                <>
                  <Typography variant="body2"><b>Business Name:</b> {profile?.business_name || "—"}</Typography>
                  <Typography variant="body2"><b>Mobile:</b> {profile?.mobile_number || "—"}</Typography>
                  <Typography variant="body2"><b>Verified:</b> {verified ? "Yes" : "No"}</Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <Button variant="contained" size="small" onClick={() => navigate("/business/profile")}>
                      Edit Profile
                    </Button>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                My Shops
              </Typography>
              {loading ? (
                <Typography variant="body2" color="text.secondary">Loading…</Typography>
              ) : (
                <>
                  <Typography variant="body2"><b>Total:</b> {shops?.length || 0}</Typography>
                  {shops?.slice(0, 3).map((s) => (
                    <Box key={s.id} sx={{ mt: 0.75 }}>
                      <Typography variant="body2">
                        {s.shop_name} — <i>{s.city || "—"}</i> [{s.status}]
                      </Typography>
                    </Box>
                  ))}
                  <Box sx={{ mt: 1.5, display: "flex", gap: 1 }}>
                    <Button variant="contained" size="small" onClick={() => navigate("/business/shops")}>
                      Manage Shops
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => navigate("/business/shops")}>
                      Create Shop
                    </Button>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Go Public
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Once approved, your shop will appear in the public marketplace. Users can browse active shops here:
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                <Button variant="outlined" onClick={() => navigate("/merchant-marketplace")}>
                  View Public Marketplace
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
