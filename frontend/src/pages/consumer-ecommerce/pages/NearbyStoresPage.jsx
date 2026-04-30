import { Link } from 'react-router-dom';
import { FaArrowLeft, FaLocationCrosshairs, FaMagnifyingGlass, FaStore } from 'react-icons/fa6';
import BottomNav from '../components/BottomNav.jsx';
import NearbyStoreCard from '../components/NearbyStoreCard.jsx';
import { nearbyStores } from '../services/mockData.js';
import '../consumerEcommerce.css';

export default function NearbyStoresPage() {
  return (
    <div className="ce-app">
      <header className="ce-header">
        <div className="ce-header-inner ce-page-header-inner">
          <Link to="/consumer-ecommerce" className="ce-icon-btn" aria-label="Back to dashboard">
            <FaArrowLeft />
          </Link>
          <div className="ce-page-title-wrap">
            <h1 className="ce-delivery-title">Nearby Stores</h1>
            <p className="ce-delivery-location">
              <FaLocationCrosshairs className="ce-primary-text" />
              Stores around Indiranagar
            </p>
          </div>
          <span className="ce-icon-btn ce-icon-btn-primary" aria-hidden="true">
            <FaStore />
          </span>
        </div>
      </header>

      <main className="ce-container">
        <label className="ce-delivery-search">
          <FaMagnifyingGlass className="ce-primary-text" />
          <input className="ce-input" placeholder="Search nearby stores" />
        </label>

        <section className="ce-delivery-section">
          <div className="ce-section-heading-row">
            <h2 className="ce-section-title">Stores near you</h2>
            <span className="ce-store-count">{nearbyStores.length} found</span>
          </div>
          <div className="ce-nearby-store-list">
            {nearbyStores.map((store) => (
              <NearbyStoreCard key={store.id} store={store} />
            ))}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
