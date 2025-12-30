import { Box } from "@mui/material";
import AppHeader from "../components/home/AppHeader";
import HeroCarousel from "../components/home/HeroCarousel";
import CategoryGrid from "../components/home/CategoryGrid";
import DealsRow from "../components/home/DealsRow";
import PrimeBanner from "../components/home/PrimeBanner";
import ProductShelf from "../components/home/ProductShelf";
import ServiceGrid from "../components/home/ServiceGrid";
import useHomeData from "../hooks/useHomeData";

export default function HomePage() {
  const data = useHomeData();
  return (
    <Box sx={{ bgcolor: "#F5F7FB", minHeight: "100vh", pb: 12 }}>
      <AppHeader />
      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <HeroCarousel banners={data.heroBanners} />
        <CategoryGrid items={data.categories} />
        <DealsRow items={data.deals} />
        <PrimeBanner active={data.isPrime} />
        <ProductShelf title="Electronics" items={data.electronics} />
        <ProductShelf title="Furniture" items={data.furniture} />
        <ProductShelf title="EV Vehicles" items={data.ev} />
        <ServiceGrid items={data.services} />
      </Box>
    </Box>
  );
}
