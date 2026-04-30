import { Link } from 'react-router-dom';
import { FaGift, FaLocationDot, FaQrcode, FaShapes, FaLocationCrosshairs } from 'react-icons/fa6';
import Header from '../components/Header.jsx';
import SearchBar from '../components/SearchBar.jsx';
import LocationSelectorModal from '../components/LocationSelectorModal.jsx';
import ShopCard from '../components/ShopCard.jsx';
import OfferCarousel from '../components/OfferCarousel.jsx';
import CategoryCarousel from '../components/CategoryCarousel.jsx';
import GiftCardsSection from '../components/GiftCardsSection.jsx';
import AdsCarousel from '../components/AdsCarousel.jsx';
import CashbackAds from '../components/CashbackAds.jsx';
import ActionGrid from '../components/ActionGrid.jsx';
import ProductCard from '../components/ProductCard.jsx';
import GridProductCard from '../components/GridProductCard.jsx';
import BottomNav from '../components/BottomNav.jsx';
import { useModal } from '../hooks/useModal.js';
import { locations, products } from '../services/mockData.js';
import '../consumerEcommerce.css';

function UtilityCard({ title, cta, icon: Icon }) {
  return (
    <article className="ce-utility-card">
      <div className="ce-utility-left">
        <span className="ce-utility-icon">
          <Icon />
        </span>
        <h3 className="ce-utility-title">{title}</h3>
      </div>
      <button className="ce-utility-btn">{cta}</button>
    </article>
  );
}

export default function App() {
  const cityModal = useModal();

  return (
    <div className="ce-app">
      <Header />
      <main className="ce-container">
        <section className="ce-section-stack">
          <SearchBar onSearch={cityModal.open} />
          <Link 
            to="/consumer-ecommerce/near-me" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              background: 'var(--ce-surface)', 
              borderRadius: '16px', 
              padding: '14px 16px', 
              textDecoration: 'none', 
              boxShadow: 'var(--ce-shadow)',
              border: '1px solid var(--ce-soft)',
              marginTop: '0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: 'linear-gradient(135deg, var(--ce-primary), var(--ce-primary-dark))', color: '#fff', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 4px 10px rgba(15, 82, 186, 0.2)' }}>
                <FaLocationCrosshairs />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: 'var(--ce-text)', fontWeight: '900', fontSize: '15px' }}>Explore Nearby</span>
                <span style={{ color: 'var(--ce-muted)', fontSize: '12px', fontWeight: '600' }}>Find services & hotels around you</span>
              </div>
            </div>
            <div style={{ background: '#eef6ff', color: 'var(--ce-primary)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>
              →
            </div>
          </Link>
        </section>

        <div className="ce-content-stack">
          <OfferCarousel />
          <GiftCardsSection />
          <AdsCarousel />

          <section className="ce-action-buttons-row">
            <Link to="/consumer-ecommerce/society" className="ce-action-btn">
              <span style={{ fontSize: '18px' }}>🤝</span> 
              <span>For Better Society</span>
            </Link>
            <Link to="/consumer-ecommerce/business" className="ce-action-btn">
              <span style={{ fontSize: '18px' }}>🏢</span> 
              <span>List Your Business</span>
            </Link>
          </section>

          <CashbackAds adType="cashback" />
          
          <ActionGrid />

          <section className="ce-content-section">
            <div className="ce-section-heading-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', marginBottom: '16px' }}>
              <h2 className="ce-section-title" style={{ fontSize: '18px' }}>Weekly offers mela</h2>
              <span style={{ fontSize: '12px', color: 'var(--ce-muted)', fontWeight: '600' }}>(50% to 70% offer Product)</span>
            </div>
            <div style={{ display: 'flex', overflowX: 'auto', gap: '12px', paddingBottom: '4px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>

          <section className="ce-content-section">
            <div className="ce-section-heading-row" style={{ marginBottom: '16px' }}>
              <h2 className="ce-section-title" style={{ fontSize: '18px' }}>Clothing Deals for You</h2>
            </div>
            <div className="ce-product-grid">
              {products.map((product) => (
                <GridProductCard key={`grid-${product.id}`} product={product} />
              ))}
            </div>
          </section>
        </div>
      </main>
      <LocationSelectorModal isOpen={cityModal.isOpen} onClose={cityModal.close} />
      <BottomNav />
    </div>
  );
}
