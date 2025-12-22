import React, { useEffect, useState } from "react";
import { Box, Container, Paper, Tabs, Tab, Typography, Grid, Card, CardContent, Chip } from "@mui/material";
import API from "../../api/api";
import SubFranchisePrimePricing from "../../components/SubFranchisePrimePricing";

/**
 * AgencyPrimePackage
 * - Tab 1: My Packages (fetched for the logged-in agency)
 * - Tab 2: Sub‑franchise Rewards (static milestones per sketch)
 *
 * "My Packages" replicates the compact cards UX used in admin (read‑only here).
 */
export default function AgencyPrimePackage() {
  const [tab, setTab] = useState("my");


  // Packages assigned to this agency (used to detect if AG_SF is already requested)
  const [packages, setPackages] = useState([]);
  const [pkgLoading, setPkgLoading] = useState(false);
  const [pkgError, setPkgError] = useState("");

  const loadAgencyPackages = async () => {
    try {
      setPkgLoading(true);
      setPkgError("");
      const res = await API.get("/business/agency-packages/", { retryAttempts: 1, cacheTTL: 5000 });
      const arr = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setPackages(arr || []);
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Failed to load packages.";
      setPkgError(String(msg));
      setPackages([]);
    } finally {
      setPkgLoading(false);
    }
  };

  useEffect(() => {
    loadAgencyPackages();
  }, []);





  return (
    <Container maxWidth="lg" sx={{ px: { xs: 0, md: 0 } }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        Agency Prime Package
      </Typography>

      <Paper sx={{ p: 1, mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab value="my" label="My Packages" />
          <Tab value="subfranchise" label="Sub‑franchise Rewards" />
        </Tabs>
      </Paper>


      {tab === "my" && (
        <Box>
          {pkgLoading ? (
            <Typography color="text.secondary">Loading...</Typography>
          ) : (packages || []).length > 0 ? (
            <Grid container spacing={2}>
              {(packages || []).map((a) => {
                const pkgName = a?.package?.name || a?.package?.code || "Prime Package";
                const st = String(a?.status || "PENDING").toUpperCase();
                const chipColor =
                  st === "ACTIVE" ? "success" :
                  st === "PARTIAL" ? "warning" :
                  st === "PENDING" ? "info" : "default";
                const toINR = (x) => {
                  try { const n = Number(x); return isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : `₹${String(x)}`; } catch { return `₹${String(x)}`; }
                };
                return (
                  <Grid item xs={12} sm={6} md={4} key={a.id}>
                    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #e5e7eb", background: "#fff" }}>
                      <CardContent>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{pkgName}</Typography>
                          <Chip size="small" label={st} color={chipColor} />
                        </Box>
                        <Grid container spacing={1}>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">Amount</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{toINR(a?.total_amount)}</Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">Paid</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{toINR(a?.paid_amount)}</Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography variant="caption" color="text.secondary">Remaining</Typography>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{toINR(a?.remaining_amount)}</Typography>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Typography color="text.secondary">No packages yet. Go to Sub‑franchise tab to purchase.</Typography>
          )}
        </Box>
      )}

      {tab === "subfranchise" && (
        <Box>
          <SubFranchisePrimePricing packages={packages} onPurchased={loadAgencyPackages} />
        </Box>
      )}
    </Container>
  );
}
