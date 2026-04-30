import { useNavigate } from 'react-router-dom';
import { FaChevronLeft, FaMobileScreenButton, FaLightbulb, FaSatelliteDish, FaDroplet, FaWifi, FaFireBurner, FaCreditCard, FaQrcode } from 'react-icons/fa6';
import { MdOutlineMoreHoriz } from 'react-icons/md';
import Header from '../components/Header.jsx';
import BottomNav from '../components/BottomNav.jsx';
import '../consumerEcommerce.css';

export default function TriPayPage() {
  const navigate = useNavigate();

  const utilities = [
    { id: 1, name: 'Recharge', icon: FaMobileScreenButton, color: '#2563eb' },
    { id: 2, name: 'Electricity', icon: FaLightbulb, color: '#eab308' },
    { id: 3, name: 'DTH', icon: FaSatelliteDish, color: '#ef4444' },
    { id: 4, name: 'Water', icon: FaDroplet, color: '#3b82f6' },
    { id: 5, name: 'Broadband', icon: FaWifi, color: '#8b5cf6' },
    { id: 6, name: 'Piped Gas', icon: FaFireBurner, color: '#f97316' },
    { id: 7, name: 'Credit Card', icon: FaCreditCard, color: '#ec4899' },
    { id: 8, name: 'More', icon: MdOutlineMoreHoriz, color: '#64748b' },
  ];

  return (
    <div className="ce-app ce-tripay-page">
      <Header />
      
      <main className="ce-container" style={{ paddingTop: '80px' }}>
        <section className="ce-tripay-wallet-card">
          <div className="ce-wallet-info">
            <span className="ce-wallet-label">TriPay Balance</span>
            <h2 className="ce-wallet-amount">₹2,450.00</h2>
          </div>
          <button className="ce-wallet-add-btn">+ Add Money</button>
        </section>

        <section className="ce-tripay-section">
          <h3 className="ce-tripay-title">Recharges & Bill Payments</h3>
          <div className="ce-tripay-grid">
            {utilities.map(item => (
              <div key={item.id} className="ce-tripay-item">
                <div className="ce-tripay-icon-wrap" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                  <item.icon />
                </div>
                <span className="ce-tripay-label">{item.name}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ce-tripay-section">
          <div className="ce-tripay-banner-promo">
            <div className="ce-promo-content">
              <h4>Flat ₹50 Cashback</h4>
              <p>On your first electricity bill payment this month</p>
              <button className="ce-promo-btn">Pay Now</button>
            </div>
            <div className="ce-promo-visual">⚡</div>
          </div>
        </section>

        <section className="ce-tripay-section">
          <h3 className="ce-tripay-title">Recent Transactions</h3>
          <div className="ce-transaction-list">
            {[1, 2, 3].map(i => (
              <div key={i} className="ce-transaction-item">
                <div className="ce-tx-icon">📱</div>
                <div className="ce-tx-info">
                  <span className="ce-tx-name">Mobile Recharge</span>
                  <span className="ce-tx-date">24 Oct, 10:20 AM</span>
                </div>
                <span className="ce-tx-amount tx-minus">- ₹299</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <button className="ce-scan-pay-fab">
        <FaQrcode />
        <span>Scan & Pay</span>
      </button>

      <BottomNav />
    </div>
  );
}
