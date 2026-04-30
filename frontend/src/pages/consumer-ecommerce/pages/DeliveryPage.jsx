import { Link } from 'react-router-dom';
import { FaArrowLeft, FaLocationCrosshairs, FaMagnifyingGlass, FaSliders, FaCartShopping } from 'react-icons/fa6';
import BottomNav from '../components/BottomNav.jsx';
import DeliveryCard from '../components/DeliveryCard.jsx';
import { stores } from '../services/mockData.js';
import '../consumerEcommerce.css';
import { useState } from 'react';

const filters = ['All', 'Food', 'Grocery', 'Pharmacy', 'Fashion'];

export default function DeliveryPage() {
  const [activeFilter, setActiveFilter] = useState('All');

  return (
    <div className="ce-app">
      <header className="ce-header ce-delivery-header">
        <div className="ce-header-inner ce-delivery-header-inner">
          <Link to="/consumer-ecommerce" className="ce-icon-btn ce-delivery-back-btn" aria-label="Back to dashboard">
            <FaArrowLeft />
          </Link>
          <div className="ce-delivery-header-title-wrap">
            <h1 className="ce-delivery-title">Tri Sarathi Delivery</h1>
            <p className="ce-delivery-location">
              <FaLocationCrosshairs style={{ color: '#f59e0b', fontSize: '11px' }} />
              Indiranagar, Bengaluru
            </p>
          </div>
          <Link to="/consumer-ecommerce/cart" className="ce-icon-btn ce-cart-btn" aria-label="View Cart">
            <FaCartShopping />
            <span className="ce-cart-badge">2</span>
          </Link>
        </div>
      </header>

      <main className="ce-container" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="ce-premium-search-container">
          <label className="ce-premium-search">
            <FaMagnifyingGlass className="ce-search-icon" />
            <input className="ce-search-input" placeholder="Search restaurants, stores, dishes" />
            <div className="ce-search-divider"></div>
            <FaSliders className="ce-search-filter-icon" />
          </label>
        </div>

        <div className="ce-premium-filter-row">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`ce-pill-filter ${activeFilter === filter ? 'ce-pill-filter-active' : ''}`}
            >
              {filter}
            </button>
          ))}
        </div>

        <section className="ce-delivery-section">
          <div className="ce-delivery-section-header">
            <h2 className="ce-premium-section-title">Fast delivery near you</h2>
            <p className="ce-premium-section-copy">Restaurants and stores ready for quick dispatch.</p>
          </div>
          <div className="ce-premium-delivery-list">
            {stores.map((store) => (
              <DeliveryCard key={store.id} store={store} />
            ))}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
