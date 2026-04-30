import { useState } from 'react';
import { FaMagnifyingGlass, FaStar, FaClock, FaLocationDot, FaFilter } from 'react-icons/fa6';
import Header from '../components/Header.jsx';
import BottomNav from '../components/BottomNav.jsx';
import DeliveryCard from '../components/DeliveryCard.jsx';
import { stores } from '../services/mockData.js';
import '../consumerEcommerce.css';

export default function TriEatPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const filters = ['All', 'Cuisines', 'Rating 4.0+', 'Offers', 'Pure Veg'];

  return (
    <div className="ce-app ce-trieat-page">
      <Header />
      
      <main className="ce-container" style={{ paddingTop: '80px' }}>
        <div className="ce-trieat-search-wrap">
          <div className="ce-trieat-search">
            <FaMagnifyingGlass className="ce-search-icon" />
            <input type="text" placeholder="Search for 'Biryani'" className="ce-search-input" />
          </div>
        </div>

        <section className="ce-trieat-filters">
          {filters.map(f => (
            <button 
              key={f} 
              className={`ce-pill-filter ${activeFilter === f ? 'ce-pill-filter-active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f === 'Offers' && '🏷️ '}{f}
            </button>
          ))}
        </section>

        <section className="ce-trieat-section">
          <h3 className="ce-section-title">What's on your mind?</h3>
          <div className="ce-trieat-categories">
            {['Biryani', 'Pizza', 'Burger', 'Thali', 'Dosa', 'Cake'].map(cat => (
              <div key={cat} className="ce-trieat-cat-item">
                <div className="ce-trieat-cat-img">🥘</div>
                <span>{cat}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ce-trieat-section">
          <h3 className="ce-section-title">Restaurants to explore</h3>
          <div className="ce-premium-delivery-list" style={{ padding: '0', marginTop: '16px' }}>
            {stores.map(store => (
              <DeliveryCard key={store.id} store={store} />
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
