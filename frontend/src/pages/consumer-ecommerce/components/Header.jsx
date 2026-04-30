import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
  FaBars,
  FaBell,
  FaCommentDots,
  FaIdCard,
  FaLocationDot,
  FaPhone,
  FaStore,
  FaUser,
  FaWallet,
  FaXmark,
} from 'react-icons/fa6';
import { consumerProfile } from '../services/mockData.js';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="ce-header">
        <div className="ce-header-inner">
          <button 
            className="ce-icon-btn" 
            onClick={() => setIsMenuOpen(true)} 
            aria-label="Open profile menu"
            style={{ background: 'transparent', border: 'none', fontSize: '20px', boxShadow: 'none' }}
          >
            <FaBars />
          </button>
          <h1 className="ce-title">Consumer Dashboard</h1>
          <div className="ce-header-actions">
            <Link
              to="/consumer-ecommerce/nearby-stores"
              className="ce-icon-btn ce-icon-btn-sm ce-tooltip-wrap"
              aria-label="Nearby Stores"
            >
              <FaStore />
              <span className="ce-tooltip">Nearby Stores</span>
            </Link>
            <button className="ce-icon-btn ce-icon-btn-sm" aria-label="Notifications">
              <FaBell />
            </button>
            <button className="ce-icon-btn ce-icon-btn-sm" aria-label="Messages">
              <FaCommentDots />
            </button>
            <button className="ce-icon-btn ce-icon-btn-sm ce-icon-btn-primary" aria-label="Location">
              <FaLocationDot />
            </button>
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <div className="ce-profile-menu-overlay" role="presentation" onClick={() => setIsMenuOpen(false)}>
          <aside className="ce-profile-menu" role="dialog" aria-label="User profile" onClick={(event) => event.stopPropagation()}>
            <div className="ce-profile-menu-head">
              <div className="ce-profile-avatar">
                <FaUser />
              </div>
              <button className="ce-icon-btn ce-icon-btn-sm" onClick={() => setIsMenuOpen(false)} aria-label="Close profile menu">
                <FaXmark />
              </button>
            </div>

            <div className="ce-profile-main">
              <p className="ce-profile-label">Profile</p>
              <h2 className="ce-profile-name">{consumerProfile.name}</h2>
              <p className="ce-profile-subtitle">{consumerProfile.membership}</p>
            </div>

            <div className="ce-profile-detail-grid">
              <div className="ce-profile-detail">
                <FaIdCard className="ce-primary-text" />
                <span>ID Number</span>
                <strong>{consumerProfile.idNumber}</strong>
              </div>
              <div className="ce-profile-detail">
                <FaLocationDot className="ce-primary-text" />
                <span>Pin Code</span>
                <strong>{consumerProfile.pinCode}</strong>
              </div>
            </div>

            <div className="ce-profile-list">
              <div className="ce-profile-list-row">
                <FaPhone className="ce-primary-text" />
                <div>
                  <span>Phone</span>
                  <strong>{consumerProfile.phone}</strong>
                </div>
              </div>
              <div className="ce-profile-list-row">
                <FaLocationDot className="ce-primary-text" />
                <div>
                  <span>Location</span>
                  <strong>{consumerProfile.city}</strong>
                </div>
              </div>
              <div className="ce-profile-list-row">
                <FaWallet className="ce-primary-text" />
                <div>
                  <span>Wallet Balance</span>
                  <strong>{consumerProfile.walletBalance}</strong>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
