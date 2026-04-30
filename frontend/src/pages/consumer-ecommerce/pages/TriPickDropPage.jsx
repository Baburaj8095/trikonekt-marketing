import { useState } from 'react';
import { FaMotorcycle, FaTruckMoving, FaTruckPickup, FaBox, FaMapPin, FaCircleDot } from 'react-icons/fa6';
import Header from '../components/Header.jsx';
import BottomNav from '../components/BottomNav.jsx';
import '../consumerEcommerce.css';

export default function TriPickDropPage() {
  const [vehicle, setVehicle] = useState('bike');

  const vehicles = [
    { id: 'bike', label: 'Two Wheeler', icon: FaMotorcycle, cap: 'Up to 20 kg' },
    { id: '3w', label: 'Three Wheeler', icon: FaTruckPickup, cap: 'Up to 500 kg' },
    { id: 'truck', label: 'Tata Ace', icon: FaTruckMoving, cap: 'Up to 750 kg' },
  ];

  return (
    <div className="ce-app ce-tripickdrop-page">
      <Header />
      
      <main className="ce-container" style={{ paddingTop: '80px' }}>
        <section className="ce-pickdrop-location-card">
          <div className="ce-location-route">
            <div className="ce-location-dot-start"><FaCircleDot /></div>
            <div className="ce-location-line"></div>
            <div className="ce-location-dot-end"><FaMapPin /></div>
          </div>
          <div className="ce-location-inputs">
            <div className="ce-loc-input-group">
              <label>Pickup Location</label>
              <input type="text" placeholder="Enter pickup address" defaultValue="Indiranagar, Bengaluru" />
            </div>
            <div className="ce-loc-input-group" style={{ marginTop: '16px' }}>
              <label>Drop Location</label>
              <input type="text" placeholder="Enter destination address" />
            </div>
          </div>
        </section>

        <section className="ce-pickdrop-section">
          <h3 className="ce-section-title">Select Vehicle</h3>
          <div className="ce-vehicle-list">
            {vehicles.map(v => (
              <div 
                key={v.id} 
                className={`ce-vehicle-card ${vehicle === v.id ? 'active' : ''}`}
                onClick={() => setVehicle(v.id)}
              >
                <div className="ce-vehicle-icon"><v.icon /></div>
                <div className="ce-vehicle-info">
                  <strong>{v.label}</strong>
                  <span>{v.cap}</span>
                </div>
                <div className="ce-vehicle-radio"></div>
              </div>
            ))}
          </div>
        </section>

        <section className="ce-pickdrop-estimate">
          <div className="ce-estimate-row">
            <span>Estimated Fare</span>
            <h2 className="ce-estimate-price">₹149 - ₹199</h2>
          </div>
          <p className="ce-estimate-note">Inclusive of all taxes and toll charges</p>
          <button className="ce-pickdrop-confirm-btn">Book {vehicle.toUpperCase()}</button>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
