import { useState } from 'react';
import { FaPlane, FaHotel, FaCar, FaTrain, FaBus, FaChevronRight } from 'react-icons/fa6';
import Header from '../components/Header.jsx';
import BottomNav from '../components/BottomNav.jsx';
import '../consumerEcommerce.css';

export default function TriTripPage() {
  const [bookingType, setBookingType] = useState('flights');

  const tabs = [
    { id: 'flights', label: 'Flights', icon: FaPlane },
    { id: 'hotels', label: 'Hotels', icon: FaHotel },
    { id: 'cabs', label: 'Cabs', icon: FaCar },
    { id: 'trains', label: 'Trains', icon: FaTrain },
  ];

  return (
    <div className="ce-app ce-tritrip-page">
      <Header />
      
      <main className="ce-container" style={{ paddingTop: '80px' }}>
        <section className="ce-tritrip-tabs">
          {tabs.map(tab => (
            <button 
              key={tab.id} 
              className={`ce-trip-tab ${bookingType === tab.id ? 'active' : ''}`}
              onClick={() => setBookingType(tab.id)}
            >
              <tab.icon />
              <span>{tab.label}</span>
            </button>
          ))}
        </section>

        <section className="ce-tritrip-search-card">
          <div className="ce-trip-form-row">
            <div className="ce-trip-input-group">
              <label>From</label>
              <div className="ce-trip-val">Bengaluru (BLR)</div>
            </div>
            <div className="ce-trip-swap">⇄</div>
            <div className="ce-trip-input-group">
              <label>To</label>
              <div className="ce-trip-val">Mumbai (BOM)</div>
            </div>
          </div>
          
          <div className="ce-trip-form-row" style={{ marginTop: '16px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
            <div className="ce-trip-input-group">
              <label>Departure</label>
              <div className="ce-trip-val">24 Oct' 2026</div>
            </div>
            <div className="ce-trip-input-group">
              <label>Travellers</label>
              <div className="ce-trip-val">1 Adult, Economy</div>
            </div>
          </div>

          <button className="ce-trip-search-btn">Search {bookingType}</button>
        </section>

        <section className="ce-tritrip-section">
          <h3 className="ce-section-title">Popular Getaways</h3>
          <div className="ce-getaway-scroll">
            {[
              { city: 'Goa', price: '₹4,500', img: '🏝️' },
              { city: 'Coorg', price: '₹3,200', img: '⛰️' },
              { city: 'Hampi', price: '₹2,800', img: '🗿' },
            ].map(g => (
              <div key={g.city} className="ce-getaway-card">
                <div className="ce-getaway-img">{g.img}</div>
                <div className="ce-getaway-info">
                  <strong>{g.city}</strong>
                  <span>Starting at {g.price}</span>
                </div>
                <FaChevronRight className="ce-getaway-arrow" />
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
