import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowLeft, FaPlay } from 'react-icons/fa6';
import Header from '../components/Header.jsx';
import BottomNav from '../components/BottomNav.jsx';

export default function AdsPage() {
  const [selectedAd, setSelectedAd] = useState(null);
  const [earnedPoints, setEarnedPoints] = useState(0);

  const ads = [
    { id: 1, brand: 'Nike', title: 'Latest Collection', points: 50, duration: '30s', image: '👟' },
    { id: 2, brand: 'Starbucks', title: 'Coffee Rewards', points: 40, duration: '25s', image: '☕' },
    { id: 3, brand: 'Amazon Prime', title: 'Prime Member Benefits', points: 60, duration: '40s', image: '📦' },
    { id: 4, brand: 'Netflix', title: 'Stream Unlimited', points: 45, duration: '35s', image: '🎬' },
    { id: 5, brand: 'Uber Eats', title: 'Food Delivery', points: 35, duration: '20s', image: '🍔' },
    { id: 6, brand: 'Flipkart', title: 'Big Sale', points: 55, duration: '38s', image: '🛍️' },
  ];

  const handleWatchAd = (ad) => {
    setSelectedAd(ad);
  };

  const handleCompleteAd = () => {
    if (selectedAd) {
      setEarnedPoints(earnedPoints + selectedAd.points);
      setSelectedAd(null);
    }
  };

  return (
    <div className="ce-app">
      <Header />
      <main className="ce-container">
        <div className="ce-ads-header">
          <Link to="/consumer-ecommerce" className="ce-back-btn">
            <FaArrowLeft />
          </Link>
          <h1 className="ce-ads-title">Watch & Earn Ads</h1>
          <div className="ce-points-badge">
            <span className="ce-points-label">Points</span>
            <span className="ce-points-value">{earnedPoints}</span>
          </div>
        </div>

        {selectedAd ? (
          <div className="ce-ad-player-container">
            <div className="ce-ad-player">
              <div className="ce-ad-player-icon">{selectedAd.image}</div>
              <h2 className="ce-ad-player-brand">{selectedAd.brand}</h2>
              <p className="ce-ad-player-title">{selectedAd.title}</p>
              <p className="ce-ad-player-duration">Duration: {selectedAd.duration}</p>
              
              <div className="ce-progress-bar">
                <div className="ce-progress-fill"></div>
              </div>

              <div className="ce-ad-reward">
                <span className="ce-reward-icon">⭐</span>
                <span className="ce-reward-points">+{selectedAd.points} Points</span>
              </div>

              <button className="ce-ad-complete-btn" onClick={handleCompleteAd}>
                Ad Completed ✓
              </button>
            </div>
          </div>
        ) : (
          <div className="ce-ads-list">
            <div className="ce-ads-section-title">Available Ads</div>
            <div className="ce-ads-grid">
              {ads.map((ad) => (
                <div key={ad.id} className="ce-ad-card">
                  <div className="ce-ad-card-image">{ad.image}</div>
                  <div className="ce-ad-card-content">
                    <p className="ce-ad-card-brand">{ad.brand}</p>
                    <p className="ce-ad-card-title">{ad.title}</p>
                    <div className="ce-ad-card-footer">
                      <span className="ce-ad-card-duration">{ad.duration}</span>
                      <span className="ce-ad-card-points">+{ad.points} pts</span>
                    </div>
                  </div>
                  <button className="ce-ad-watch-btn" onClick={() => handleWatchAd(ad)}>
                    <FaPlay />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
